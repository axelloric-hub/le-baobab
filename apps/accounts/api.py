"""Authentification : inscription + confirmation par OTP, connexion JWT, rafraichissement, deconnexion, mot de passe oublie, appareils."""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers as s
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import otp
from apps.accounts.models import USERNAME_RE, Device, LoginAttempt, LoginHistory, User
from apps.accounts.services import register_user
from apps.audit.services import security_event
from apps.core import redis as R
from apps.core.api import client_ip, endpoint, paginate, user_agent
from apps.core.exceptions import ConflictError, DomainError, InvalidCredentialsError, PermissionDeniedError, RateLimitedError

def em():
    return s.EmailField()


def pw():
    # UNE NOUVELLE instance a chaque appel : reutiliser la meme instance pour deux champs d'un meme serializer les lie tous deux au dernier nom.
    return s.CharField(trim_whitespace=False, max_length=128)


def _tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _check_password(password: str, user: User | None = None) -> None:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise s.ValidationError({"password": list(exc.messages)}) from exc


def _user_payload(u: User) -> dict:
    return {"id": str(u.pk), "email": u.email, "username": u.username, "status": u.status, "email_verified": u.email_verified_at is not None}


@endpoint("Creer un compte (statut 'pending') et envoyer un code OTP par e-mail.", auth="public", status=201,
          body={"email": em(), "username": s.RegexField(USERNAME_RE, error_messages={"invalid": "3-30 caracteres : a-z, 0-9, _ et ."}), "password": pw(),
                "display_name": s.CharField(max_length=80, required=False)})
def register(request):
    d = request.input
    email, username = d["email"].lower(), d["username"].lower()
    existing = User.objects.filter(email=email).first()
    if existing is not None:
        if existing.email_verified_at is not None:
            raise ConflictError("Cette adresse e-mail est deja utilisee.", code="email_taken")
        # compte jamais confirme : on ne modifie RIEN (ni mot de passe, ni pseudo) et on renvoie un code a l'adresse
        return {"user": _user_payload(existing), "otp": otp.issue_otp(email, "verify_email", ip=client_ip(request)).as_dict()}
    _check_password(d["password"], User(email=email, username=username))
    user = register_user(email=email, username=username, password=d["password"], display_name=d.get("display_name"))
    return {"user": _user_payload(user), "otp": otp.issue_otp(email, "verify_email", ip=client_ip(request)).as_dict()}


@endpoint("Confirmer l'adresse e-mail avec le code OTP ; renvoie directement les jetons de connexion.", auth="public",
          body={"email": em(), "code": s.CharField(min_length=6, max_length=6)})
def verify_email(request):
    d = request.input
    email = d["email"].lower()
    allowed, _, _ = R.rate_limit("otp_verify", client_ip(request) or "?", 30, 900)
    if not allowed:
        raise RateLimitedError("Trop de tentatives.", code="otp_ip_limited")
    user = User.objects.filter(email=email).first()
    if user is None:
        raise DomainError("Code expire ou inexistant : demandez-en un nouveau.", code="otp_expired")  # meme reponse qu'un code expire : pas d'enumeration
    otp.verify_otp(email, "verify_email", d["code"])
    if user.email_verified_at is None:
        user.email_verified_at = timezone.now()
        if user.status == User.Status.PENDING:
            user.status = User.Status.ACTIVE
        user.save(update_fields=["email_verified_at", "status"])
    return {"user": _user_payload(user), **_tokens(user)}


@endpoint("Renvoyer un code OTP (delai de 60 s entre deux envois). Reponse identique que le compte existe ou non.", auth="public",
          body={"email": em(), "purpose": s.ChoiceField(choices=["verify_email", "reset_password"], default="verify_email")})
def resend_otp(request):
    d = request.input
    email = d["email"].lower()
    user = User.objects.filter(email=email).first()
    eligible = user is not None and ((d["purpose"] == "verify_email" and user.email_verified_at is None) or (d["purpose"] == "reset_password" and user.email_verified_at is not None))
    if not eligible:
        return {"email_sent": True, "reason": "sent", "expires_in_seconds": otp.settings.OTP_TTL_SECONDS}  # leurre : ne revele pas l'existence du compte
    return otp.issue_otp(email, d["purpose"], ip=client_ip(request)).as_dict()


@endpoint("Se connecter avec e-mail et mot de passe. Refuse les comptes non confirmes ou suspendus.", auth="public", body={"email": em(), "password": pw()})
def login(request):
    d = request.input
    email, ip = d["email"].lower(), client_ip(request)
    for scope, ident, limit in (("login_email", email, 10), ("login_ip", ip or "?", 40)):
        allowed, _, _ = R.rate_limit(scope, ident, limit, 900)
        if not allowed:
            raise RateLimitedError("Trop de tentatives de connexion, reessayez dans quelques minutes.", code="login_rate_limited")
    user = User.objects.filter(email=email).first()
    if user is None or not user.check_password(d["password"]) or user.status in (User.Status.DELETED, User.Status.ANONYMIZED):
        LoginAttempt.objects.create(identifier=email, ip_address=ip, success=False, reason="invalid_credentials")
        if user is not None:
            LoginHistory.objects.create(user=user, success=False, ip_address=ip, user_agent=user_agent(request))
        raise _invalid_credentials()
    if user.status == User.Status.SUSPENDED:
        raise PermissionDeniedError("Compte suspendu.", code="account_suspended")
    if user.email_verified_at is None:
        raise PermissionDeniedError("Confirmez d'abord votre e-mail avec le code recu.", code="email_not_verified")
    LoginAttempt.objects.create(identifier=email, ip_address=ip, success=True)
    LoginHistory.objects.create(user=user, success=True, ip_address=ip, user_agent=user_agent(request))
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return {"user": _user_payload(user), **_tokens(user)}


def _invalid_credentials():
    return InvalidCredentialsError("E-mail ou mot de passe incorrect.")


@endpoint("Obtenir un nouveau jeton d'acces ; le jeton de rafraichissement est renouvele et l'ancien invalide (rotation).", auth="public", body={"refresh": s.CharField()})
def refresh(request):
    ser = TokenRefreshSerializer(data={"refresh": request.input["refresh"]})
    try:
        ser.is_valid(raise_exception=True)
    except TokenError as exc:
        from rest_framework.exceptions import AuthenticationFailed

        raise AuthenticationFailed("Jeton de rafraichissement invalide ou expire.") from exc
    return ser.validated_data


@endpoint("Se deconnecter : invalide le jeton de rafraichissement.", auth="public", body={"refresh": s.CharField()}, status=204)
def logout(request):
    try:
        RefreshToken(request.input["refresh"]).blacklist()
    except TokenError:
        pass  # deja invalide : l'objectif (ne plus pouvoir rafraichir) est atteint
    from rest_framework.response import Response

    return Response(status=204)


@endpoint("Mot de passe oublie : envoie un code OTP. Reponse toujours identique (pas d'enumeration de comptes).", auth="public", body={"email": em()})
def forgot_password(request):
    email = request.input["email"].lower()
    user = User.objects.filter(email=email, email_verified_at__isnull=False).first()
    if user is None:
        return {"email_sent": True, "reason": "sent", "expires_in_seconds": otp.settings.OTP_TTL_SECONDS}
    return otp.issue_otp(email, "reset_password", ip=client_ip(request)).as_dict()


@endpoint("Reinitialiser le mot de passe avec le code OTP ; invalide toutes les sessions existantes.", auth="public",
          body={"email": em(), "code": s.CharField(min_length=6, max_length=6), "new_password": pw()})
def reset_password(request):
    d = request.input
    email = d["email"].lower()
    user = User.objects.filter(email=email, email_verified_at__isnull=False).first()
    if user is None:
        raise DomainError("Code expire ou inexistant : demandez-en un nouveau.", code="otp_expired")
    _check_password(d["new_password"], user)
    otp.verify_otp(email, "reset_password", d["code"])
    user.set_password(d["new_password"])
    user.password_changed_at = timezone.now()
    user.save(update_fields=["password", "password_changed_at"])
    for t in OutstandingToken.objects.filter(user=user):  # toutes les sessions ouvertes sont revoquees
        BlacklistedToken.objects.get_or_create(token=t)
    security_event(event_type="password_reset", user=user, ip=client_ip(request))
    return {"password_reset": True}


@endpoint("Changer son mot de passe (connaissant l'ancien) ; revoque les autres sessions.", body={"current_password": pw(), "new_password": pw()})
def change_password(request):
    d, user = request.input, request.user
    if not user.check_password(d["current_password"]):
        raise PermissionDeniedError("Mot de passe actuel incorrect.", code="invalid_credentials")
    _check_password(d["new_password"], user)
    user.set_password(d["new_password"])
    user.password_changed_at = timezone.now()
    user.save(update_fields=["password", "password_changed_at"])
    for t in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=t)
    security_event(event_type="password_changed", user=user, ip=client_ip(request))
    return _tokens(user)  # nouvelle session pour l'appareil courant


@endpoint("Historique de mes connexions (reussies et echouees).")
def login_history(request):
    qs = LoginHistory.objects.filter(user=request.user)
    return paginate(request, qs, ("-created_at", "-id"), lambda h: {"success": h.success, "ip": h.ip_address, "user_agent": h.user_agent, "at": h.created_at})


@endpoint("Mes appareils connus.")
def devices(request):
    return [{"id": str(d.pk), "platform": d.platform, "label": d.label, "last_seen_at": d.last_seen_at} for d in Device.objects.filter(user=request.user, revoked_at__isnull=True)]
