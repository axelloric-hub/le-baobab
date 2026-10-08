"""GitHub : OAuth App (connexion / liaison de compte) et API REST officielle (lecture des depots PUBLICS).

Securite :
 - `state` aleatoire, a usage unique, garde 10 min dans Redis (anti-CSRF) ; il porte aussi le mode (login | link) et l'utilisateur a lier ;
 - le jeton GitHub n'est jamais renvoye au frontend (stocke chiffre) ;
 - toutes les URL appelees sont des constantes : aucune URL fournie par un utilisateur n'est jamais requetee (pas de SSRF) ;
 - un depot n'est accepte que s'il est PUBLIC (un jeton utilisateur ne doit pas faire fuiter un depot prive).
"""
from __future__ import annotations

import json
import re
import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings

from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.exceptions import DomainError, ExternalServiceError

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
API_URL = "https://api.github.com"
OAUTH_SCOPES = "read:user user:email"  # lecture du profil et des e-mails verifies ; aucun droit sur les depots
TIMEOUT = (4, 10)  # (connexion, lecture) en secondes
REPO_CACHE_TTL = 600

_OWNER = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})"
REPO_URL_RE = re.compile(rf"^https://(?:www\.)?github\.com/(?P<owner>{_OWNER})/(?P<repo>[A-Za-z0-9._-]{{1,100}}?)(?:\.git)?/?$")


def configured() -> bool:
    return bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET and settings.GITHUB_REDIRECT_URI)


def _require_configured() -> None:
    if not configured():
        raise ExternalServiceError("La connexion GitHub n'est pas configuree sur ce serveur.", code="github_not_configured")


def _http(method: str, url: str, **kwargs):
    """Unique point d'appel reseau (remplace dans les tests). Erreurs reseau => 503 propre."""
    try:
        return requests.request(method, url, timeout=TIMEOUT, **kwargs)
    except requests.RequestException as exc:
        raise ExternalServiceError("GitHub est injoignable, reessayez dans un instant.", code="github_unreachable") from exc


def _json(resp) -> dict | list:
    try:
        return resp.json()
    except ValueError as exc:
        raise ExternalServiceError("Reponse inattendue de GitHub.", code="github_bad_response") from exc


# ------------------------------------------------------------------ OAuth
def new_state(mode: str, user_id=None) -> str:
    state = secrets.token_urlsafe(32)
    R.get_redis().set(K.oauth_state(state), json.dumps({"mode": mode, "user": str(user_id) if user_id else None}), ex=K.TTL_OAUTH_STATE)
    return state


def pop_state(state: str) -> dict:
    """Lecture ET suppression atomiques : un `state` ne sert qu'une fois."""
    raw = R.get_redis().getdel(K.oauth_state(state)) if state and len(state) <= 100 else None
    if not raw:
        raise DomainError("Demande de connexion expiree ou invalide : recommencez.", code="github_state_invalid")
    return json.loads(raw)


def authorize_url(state: str) -> str:
    _require_configured()
    q = {"client_id": settings.GITHUB_CLIENT_ID, "redirect_uri": settings.GITHUB_REDIRECT_URI, "scope": OAUTH_SCOPES, "state": state, "allow_signup": "true"}
    return f"{AUTHORIZE_URL}?{urlencode(q)}"


def exchange_code(code: str) -> tuple[str, list[str]]:
    _require_configured()
    resp = _http("POST", TOKEN_URL, headers={"Accept": "application/json"},
                 data={"client_id": settings.GITHUB_CLIENT_ID, "client_secret": settings.GITHUB_CLIENT_SECRET, "code": code, "redirect_uri": settings.GITHUB_REDIRECT_URI})
    data = _json(resp)
    token = data.get("access_token") if isinstance(data, dict) else None
    if not token:
        err = data.get("error") if isinstance(data, dict) else None
        if err == "bad_verification_code":
            raise DomainError("Code GitHub expire ou deja utilise : recommencez.", code="github_code_invalid")
        raise ExternalServiceError("GitHub a refuse l'echange du code (verifiez la configuration de l'application OAuth).", code="github_exchange_failed")
    return token, [s for s in str(data.get("scope", "")).replace(",", " ").split() if s]


def _api_headers(token: str | None) -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "le-baobab"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def fetch_user(token: str) -> dict:
    resp = _http("GET", f"{API_URL}/user", headers=_api_headers(token))
    if resp.status_code != 200:
        raise ExternalServiceError("Impossible de lire le profil GitHub.", code="github_profile_failed")
    data = _json(resp)
    return {"id": str(data["id"]), "login": data["login"], "name": data.get("name") or "", "avatar_url": data.get("avatar_url") or ""}


def fetch_verified_email(token: str) -> str | None:
    """E-mail principal VERIFIE par GitHub (jamais un e-mail non verifie : sinon n'importe qui pourrait revendiquer l'adresse d'autrui)."""
    resp = _http("GET", f"{API_URL}/user/emails", headers=_api_headers(token))
    if resp.status_code != 200:
        return None
    emails = [e for e in _json(resp) if isinstance(e, dict) and e.get("verified") and e.get("email") and not str(e["email"]).endswith("@users.noreply.github.com")]
    emails.sort(key=lambda e: not e.get("primary"))
    return str(emails[0]["email"]).lower() if emails else None


# ------------------------------------------------------------------ depots
def parse_repo_url(url: str) -> tuple[str, str] | None:
    m = REPO_URL_RE.match(url.strip())
    if not m or m["repo"] in (".", "..") or m["repo"].endswith("."):
        return None
    return m["owner"], m["repo"]


def fetch_repo(owner: str, repo: str, user_token: str | None = None) -> dict:
    """Lit un depot PUBLIC via l'API officielle. Cache 10 min (donnees publiques uniquement)."""
    full = f"{owner}/{repo}"
    cached = R.get_redis().get(K.github_repo_cache(full))
    if cached:
        return json.loads(cached)
    token = settings.GITHUB_API_TOKEN or user_token or None
    resp = _http("GET", f"{API_URL}/repos/{owner}/{repo}", headers=_api_headers(token))
    if resp.status_code == 401 and token:  # jeton revoque : on retente en anonyme
        resp = _http("GET", f"{API_URL}/repos/{owner}/{repo}", headers=_api_headers(None))
    if resp.status_code == 404:
        raise DomainError("Depot introuvable, ou prive : seuls les depots publics sont acceptes.", code="repository_not_found")
    if resp.status_code in (403, 429):
        raise ExternalServiceError("Limite d'appels GitHub atteinte, reessayez dans quelques minutes.", code="github_rate_limited")
    if resp.status_code != 200:
        raise ExternalServiceError("GitHub n'a pas pu repondre.", code="github_api_failed")
    d = _json(resp)
    if d.get("private"):
        raise DomainError("Ce depot est prive : seuls les depots publics sont acceptes.", code="repository_private")
    out = {"full_name": d["full_name"], "url": d["html_url"], "description": (d.get("description") or "")[:500], "language": (d.get("language") or "")[:40],
           "stars": int(d.get("stargazers_count") or 0), "owner_id": str((d.get("owner") or {}).get("id", "")), "owner_login": (d.get("owner") or {}).get("login", ""),
           "is_fork": bool(d.get("fork")), "archived": bool(d.get("archived")), "pushed_at": d.get("pushed_at")}
    R.get_redis().set(K.github_repo_cache(full), json.dumps(out), ex=REPO_CACHE_TTL)
    return out
