"""Cas d'usage des integrations : connexion avec GitHub, liaison de compte, description de liens (YouTube, LinkedIn, GitHub)."""
from __future__ import annotations

import json
import re
import secrets

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.exceptions import ConflictError, DomainError, ExternalServiceError, PermissionDeniedError
from apps.integrations import github, links
from apps.integrations.models import ExternalAccount

YOUTUBE_OEMBED = "https://www.youtube.com/oembed"


# ------------------------------------------------------------------ jeton de connexion a usage unique
def issue_ticket(user_id) -> str:
    """Billet a usage unique (90 s) echange par le frontend contre les jetons JWT : les JWT ne transitent jamais par une URL."""
    ticket = secrets.token_urlsafe(32)
    R.get_redis().set(K.login_ticket(ticket), str(user_id), ex=K.TTL_LOGIN_TICKET)
    return ticket


def redeem_ticket(ticket: str) -> User:
    uid = R.get_redis().getdel(K.login_ticket(ticket)) if ticket and len(ticket) <= 100 else None
    user = User.objects.filter(pk=uid).first() if uid else None
    if user is None:
        raise DomainError("Billet de connexion expire ou invalide : recommencez.", code="ticket_invalid")
    _assert_can_login(user)
    return user


def _assert_can_login(user: User) -> None:
    if user.status == User.Status.SUSPENDED:
        raise PermissionDeniedError("Compte suspendu.", code="account_suspended")
    if user.status in (User.Status.DELETED, User.Status.ANONYMIZED):
        raise DomainError("Compte introuvable.", code="account_gone")


# ------------------------------------------------------------------ connexion / liaison GitHub
def _username_from(login: str) -> str:
    base = re.sub(r"[^a-z0-9_.]", "_", login.lower()).strip("_.") or "dev"
    if not base[0].isalnum():
        base = "dev" + base
    base = base[:24].ljust(3, "0")
    candidate = base
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base[:22]}{secrets.randbelow(10**6):06d}"[:30]
    return candidate


def _store_account(user: User, gh: dict, token: str, scopes: list[str]) -> ExternalAccount:
    acc, _ = ExternalAccount.objects.update_or_create(
        provider_id="github", external_id=gh["id"],
        defaults={"user": user, "handle": gh["login"], "access_token": token, "refresh_token": "", "scopes": scopes, "token_expires_at": None, "revoked_at": None, "connected_at": timezone.now()})
    from apps.profiles.models import SocialLink

    url = f"https://github.com/{gh['login']}"
    SocialLink.objects.filter(user=user, provider="github").exclude(url=url).update(is_verified=False)
    SocialLink.objects.update_or_create(user=user, provider="github", url=url, defaults={"handle": gh["login"], "is_verified": True})
    return acc


@transaction.atomic
def _link(user_id, gh: dict, token: str, scopes: list[str]) -> dict:
    user = User.objects.select_for_update().get(pk=user_id)
    _assert_can_login(user)
    existing = ExternalAccount.objects.filter(provider_id="github", external_id=gh["id"]).first()
    if existing and existing.user_id != user.pk:
        raise ConflictError("Ce compte GitHub est deja lie a un autre compte LE BAOBAB.", code="github_already_linked")
    mine = ExternalAccount.objects.filter(user=user, provider_id="github", revoked_at__isnull=True).first()
    if mine and mine.external_id != gh["id"]:
        raise ConflictError("Un autre compte GitHub est deja connecte : deconnectez-le d'abord.", code="github_already_connected")
    _store_account(user, gh, token, scopes)
    return {"mode": "link", "connected": True, "github_login": gh["login"]}


def _login_or_signup(gh: dict, token: str, scopes: list[str]) -> dict:
    acc = ExternalAccount.objects.select_related("user").filter(provider_id="github", external_id=gh["id"]).first()
    if acc is not None:
        _assert_can_login(acc.user)
        with transaction.atomic():
            _store_account(acc.user, gh, token, scopes)
        return {"mode": "login", "user": acc.user, "created": False}
    email = github.fetch_verified_email(token)
    if not email:
        raise DomainError("Aucune adresse e-mail verifiee sur ce compte GitHub : verifiez-en une dans les parametres GitHub (Emails), puis recommencez.", code="github_email_unverified")
    if User.objects.filter(email=email).exists():
        # Jamais de fusion automatique par e-mail : ce serait une prise de controle de compte possible. L'utilisateur lie GitHub depuis son compte.
        raise ConflictError("Un compte existe deja avec l'adresse e-mail de ce compte GitHub. Connectez-vous avec votre mot de passe, puis liez GitHub depuis vos parametres.", code="email_taken_connect_instead")
    from apps.accounts.services import register_user

    try:
        with transaction.atomic():
            user = register_user(email=email, username=_username_from(gh["login"]), password=secrets.token_urlsafe(32), display_name=(gh["name"] or gh["login"])[:80])
            user.set_unusable_password()
            user.email_verified_at, user.status = timezone.now(), User.Status.ACTIVE
            user.save(update_fields=["password", "email_verified_at", "status"])
            _store_account(user, gh, token, scopes)
    except IntegrityError as exc:
        raise ConflictError("Conflit lors de la creation du compte, recommencez.", code="signup_conflict") from exc
    return {"mode": "login", "user": user, "created": True}


def handle_callback(code: str, state: str) -> dict:
    st = github.pop_state(state)
    token, scopes = github.exchange_code(code)
    gh = github.fetch_user(token)
    if st["mode"] == "link":
        return _link(st["user"], gh, token, scopes)
    return _login_or_signup(gh, token, scopes)


def github_token_of(user) -> str | None:
    acc = ExternalAccount.objects.filter(user=user, provider_id="github", revoked_at__isnull=True).first()
    return acc.access_token or None if acc else None


def github_account_of(user) -> ExternalAccount | None:
    return ExternalAccount.objects.filter(user=user, provider_id="github", revoked_at__isnull=True).first()


# ------------------------------------------------------------------ description de liens
def _youtube_enrich(desc: dict) -> dict:
    """oEmbed officiel : confirme que la video existe ET qu'elle peut etre integree ailleurs ; ramene titre et auteur. Facultatif : une panne n'empeche pas l'ajout."""
    if not settings.YOUTUBE_OEMBED_ENABLED or desc["kind"] != "video":
        return {**desc, "verified": False}
    key = K.youtube_oembed(desc["video_id"])
    cached = R.get_redis().get(key)
    if cached:
        return {**desc, **json.loads(cached), "verified": True}
    try:
        resp = requests.get(YOUTUBE_OEMBED, params={"url": desc["canonical_url"], "format": "json"}, timeout=(3, 4))
    except requests.RequestException:
        return {**desc, "verified": False}
    if resp.status_code == 404:
        raise DomainError("Video introuvable (supprimee ou privee).", code="video_not_found")
    if resp.status_code in (401, 403):
        raise DomainError("Le proprietaire de cette video interdit son affichage hors de YouTube.", code="video_not_embeddable")
    if resp.status_code != 200:
        return {**desc, "verified": False}
    try:
        data = resp.json()
    except ValueError:
        return {**desc, "verified": False}
    extra = {"title": str(data.get("title", ""))[:200], "author": str(data.get("author_name", ""))[:100]}
    R.get_redis().set(key, json.dumps(extra), ex=86400)
    return {**desc, **extra, "verified": True}


def describe_link(url: str, user=None) -> dict:
    """Reconnait un lien et le complete (YouTube : oEmbed ; depot GitHub : API officielle)."""
    desc = links.resolve(url)
    if desc["provider"] == "youtube":
        return _youtube_enrich(desc)
    if desc["provider"] == "github" and desc["kind"] == "repository":
        repo = github.fetch_repo(desc["owner"], desc["repo"], github_token_of(user) if user else None)
        return {**desc, "verified": True, "repository": repo}
    return {**desc, "verified": False}


def block_payload(desc: dict) -> dict:
    """Ce qui est conserve dans un bloc de cours (jamais d'URL d'embed fournie par l'utilisateur : toujours reconstruite par links.py)."""
    keep = ("provider", "kind", "video_id", "playlist_id", "start_seconds", "embed_url", "thumbnail_url", "canonical_url", "title", "author", "handle", "owner", "repo")
    out = {k: desc[k] for k in keep if desc.get(k) is not None}
    if desc.get("repository"):
        out["repository"] = {k: desc["repository"][k] for k in ("full_name", "description", "language", "stars", "owner_login")}
    return out
