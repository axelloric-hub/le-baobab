"""Integrations externes : connexion avec GitHub (OAuth), liaison/deconnexion de comptes, description des liens YouTube / LinkedIn / GitHub."""
from __future__ import annotations

from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers as s
from rest_framework.response import Response

from apps.accounts.api import _tokens, _user_payload
from apps.accounts.models import LoginHistory
from apps.core import redis as R
from apps.core.api import client_ip, endpoint, get_or_404, user_agent
from apps.core.exceptions import ConflictError, DomainError, RateLimitedError
from apps.integrations import github
from apps.integrations import services as S
from apps.integrations.models import ExternalAccount, ExternalProvider


def _limit(scope: str, ident, limit: int, window: int) -> None:
    allowed, _, _ = R.rate_limit(scope, ident or "?", limit, window)
    if not allowed:
        raise RateLimitedError("Trop de demandes, reessayez dans quelques minutes.")


@endpoint("Fournisseurs externes pris en charge. `available` : la connexion OAuth est-elle configuree sur ce serveur ?", auth="public")
def providers(request):
    return [{"code": p.pk, "name": p.name, "supports_oauth": p.supports_oauth, "supports_embed": p.supports_embed,
             "available": github.configured() if p.pk == "github" else False} for p in ExternalProvider.objects.filter(is_active=True)]


@endpoint("Mes comptes externes connectes (jamais les jetons).")
def my_accounts(request):
    return [{"id": str(a.pk), "provider": a.provider_id, "handle": a.handle, "scopes": a.scopes, "connected_at": a.connected_at} for a in ExternalAccount.objects.filter(user=request.user, revoked_at__isnull=True)]


@endpoint("Deconnecter un de mes comptes externes. Refuse si c'est votre seul moyen de connexion (compte cree via GitHub, sans mot de passe).", status=204)
def disconnect(request, account_id):
    acc = get_or_404(ExternalAccount.objects.filter(pk=account_id, user=request.user))
    if acc.provider_id == "github" and not request.user.has_usable_password():
        raise ConflictError("Definissez d'abord un mot de passe (« mot de passe oublie » avec votre e-mail), sinon vous ne pourriez plus vous connecter.", code="set_password_first")
    acc.delete()
    return Response(status=204)


# ------------------------------------------------------------------ connexion avec GitHub
@endpoint("Connexion avec GitHub, etape 1 : renvoie l'adresse GitHub vers laquelle envoyer le navigateur de l'utilisateur.", auth="public")
def github_start(request):
    _limit("github_start", client_ip(request), 30, 600)
    return {"authorize_url": github.authorize_url(github.new_state("login")), "expires_in_seconds": 600}


@endpoint("Lier GitHub a MON compte (connecte), etape 1 : meme principe que la connexion, mais le compte lie sera le mien.")
def github_connect(request):
    _limit("github_connect", request.user.pk, 10, 600)
    return {"authorize_url": github.authorize_url(github.new_state("link", request.user.pk)), "expires_in_seconds": 600}


def _frontend_redirect(params: dict):
    base = settings.GITHUB_LOGIN_FRONTEND_URL
    host = urlsplit(base)
    if host.scheme != "https" and not (host.scheme == "http" and host.hostname in ("localhost", "127.0.0.1")):
        return None  # URL de frontend invalide : on repond en JSON plutot que de rediriger vers n'importe quoi
    sep = "&" if "?" in base else "?"
    return Response(status=302, headers={"Location": f"{base}{sep}{urlencode(params)}"})


@endpoint("Retour de GitHub (adresse declaree dans l'OAuth App). Sans frontend configure : reponse JSON avec un billet a echanger. Avec frontend : redirection vers lui (?ticket=... ou ?error=...).",
          auth="public", query={"code": s.CharField(required=False, max_length=300), "state": s.CharField(required=False, max_length=200), "error": s.CharField(required=False, max_length=100)})
def github_callback(request):
    _limit("github_callback", client_ip(request), 40, 600)
    q = request.q
    try:
        if q.get("error"):
            if q.get("state"):
                try:
                    github.pop_state(q["state"])  # consomme le state
                except DomainError:
                    pass
            raise DomainError("Connexion GitHub annulee.", code="github_access_denied")
        if not q.get("code") or not q.get("state"):
            raise DomainError("Retour GitHub incomplet.", code="github_callback_invalid")
        result = S.handle_callback(q["code"], q["state"])
    except DomainError as exc:
        redirect = _frontend_redirect({"error": exc.code}) if settings.GITHUB_LOGIN_FRONTEND_URL else None
        if redirect is not None:
            return redirect
        raise
    if result["mode"] == "link":
        out, params = {"connected": True, "github_login": result["github_login"]}, {"linked": "github"}
    else:
        ticket = S.issue_ticket(result["user"].pk)
        out, params = {"ticket": ticket, "account_created": result["created"], "next": "POST /api/v1/auth/github/exchange/ avec {\"ticket\": ...}"}, {"ticket": ticket}
    if settings.GITHUB_LOGIN_FRONTEND_URL:
        redirect = _frontend_redirect(params)
        if redirect is not None:
            return redirect
    return out


@endpoint("Connexion avec GitHub, etape finale : echange le billet (usage unique, 90 s) contre les jetons de connexion.", auth="public", body={"ticket": s.CharField(max_length=100)})
def github_exchange(request):
    ip = client_ip(request)
    _limit("github_exchange", ip, 30, 600)
    user = S.redeem_ticket(request.input["ticket"])
    LoginHistory.objects.create(user=user, success=True, ip_address=ip, user_agent=user_agent(request))
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return {"user": _user_payload(user), **_tokens(user)}


# ------------------------------------------------------------------ liens
@endpoint("Analyser un lien YouTube, LinkedIn ou GitHub : renvoie le fournisseur, l'adresse propre, et pour YouTube l'adresse du lecteur integre (la video se lit dans l'application). Un depot GitHub est verifie via l'API officielle.",
          body={"url": s.CharField(max_length=600)})
def resolve_link(request):
    _limit("resolve_link", request.user.pk, 60, 3600)
    desc = S.describe_link(request.input["url"], request.user)
    return S.block_payload(desc) | {"verified": desc["verified"]}
