"""OTP par e-mail (SMTP). Garanties : code a 6 chiffres aleatoire (secrets), stocke haché, valable 10 min, 5 essais, un seul code valide a la fois,
delai entre deux envois, plafond QUOTIDIEN global d'e-mails (quota du compte SMTP) arbitre sous verrou PostgreSQL (pas de depassement concurrent).
Si le message ne part pas (SMTP en panne, quota atteint), le code est QUAND MEME cree ; en phase de test (OTP_DEBUG_ECHO) il est renvoye a l'ecran."""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import EmailOTP
from apps.audit.services import system_event
from apps.core import redis as R
from apps.core.exceptions import DomainError, RateLimitedError

log = logging.getLogger(__name__)
QUOTA_LOCK_ID = 727_001
SUBJECTS = {"verify_email": "Votre code de confirmation LE BAOBAB", "reset_password": "Votre code de reinitialisation LE BAOBAB"}


@dataclass
class OTPIssue:
    emailed: bool
    reason: str  # sent | daily_quota_reached | email_failed
    expires_in: int
    debug_code: str | None = None

    def as_dict(self) -> dict:
        out = {"email_sent": self.emailed, "reason": self.reason, "expires_in_seconds": self.expires_in}
        if self.debug_code is not None:
            out["debug_code"] = self.debug_code  # PHASE DE TEST UNIQUEMENT (OTP_DEBUG_ECHO)
        return out


def _hash(email: str, purpose: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{email}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


def _today_start():
    return timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)


def emails_sent_today() -> int:
    return EmailOTP.objects.filter(emailed=True, created_at__gte=_today_start()).count()


def issue_otp(email: str, purpose: str, *, ip: str | None = None) -> OTPIssue:
    email = email.strip().lower()
    now = timezone.now()
    last = EmailOTP.objects.filter(email=email, purpose=purpose).order_by("-created_at").first()
    if last and (now - last.created_at).total_seconds() < settings.OTP_RESEND_COOLDOWN_SECONDS:
        wait = settings.OTP_RESEND_COOLDOWN_SECONDS - int((now - last.created_at).total_seconds())
        raise RateLimitedError(f"Patientez {wait} s avant de redemander un code.", code="otp_cooldown")
    if ip:
        allowed, _, _ = R.rate_limit("otp_ip", ip, 10, 3600)
        if not allowed:
            raise RateLimitedError("Trop de demandes de code depuis cette adresse.", code="otp_ip_limited")
    code = f"{secrets.randbelow(10**6):06d}"
    with transaction.atomic():
        EmailOTP.objects.filter(email=email, purpose=purpose, consumed_at__isnull=True).update(consumed_at=now)  # un seul code valide a la fois
        otp = EmailOTP.objects.create(email=email, purpose=purpose, code_hash=_hash(email, purpose, code), ip_address=ip,
                                      expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS))
        with connection.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(%s)", [QUOTA_LOCK_ID])  # serialise controle du quota + envoi
        reason = "sent"
        if emails_sent_today() >= settings.OTP_EMAIL_DAILY_LIMIT:
            reason = "daily_quota_reached"
        else:
            try:
                minutes = settings.OTP_TTL_SECONDS // 60
                send_mail(SUBJECTS[purpose], f"Votre code LE BAOBAB : {code}\n\nIl est valable {minutes} minutes. Si vous n'etes pas a l'origine de cette demande, ignorez ce message.",
                          settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
                EmailOTP.objects.filter(pk=otp.pk).update(emailed=True)
            except Exception as exc:  # noqa: BLE001 - SMTP indisponible : on ne perd pas l'inscription
                reason = "email_failed"
                log.warning("otp email failed: %r", exc)
                system_event(component="otp", message=f"Echec d'envoi SMTP: {exc.__class__.__name__}", level="warning")
    return OTPIssue(emailed=reason == "sent", reason=reason, expires_in=settings.OTP_TTL_SECONDS, debug_code=code if settings.OTP_DEBUG_ECHO else None)


def verify_otp(email: str, purpose: str, code: str) -> None:
    """Consomme le code ou leve une erreur ; le compteur d'essais est persiste MEME en cas d'echec (l'erreur est levee hors transaction)."""
    email = email.strip().lower()
    outcome = None
    with transaction.atomic():
        otp = EmailOTP.objects.select_for_update().filter(email=email, purpose=purpose, consumed_at__isnull=True).order_by("-created_at").first()
        if otp is None or otp.expires_at < timezone.now():
            outcome = ("otp_expired", "Code expire ou inexistant : demandez-en un nouveau.")
        elif otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            outcome = ("otp_locked", "Trop d'essais : demandez un nouveau code.")
        elif hmac.compare_digest(otp.code_hash, _hash(email, purpose, code.strip())):
            otp.consumed_at = timezone.now()
            otp.save(update_fields=["consumed_at"])
        else:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            left = settings.OTP_MAX_ATTEMPTS - otp.attempts
            outcome = ("otp_invalid", f"Code incorrect ({left} essai(s) restant(s)).")
    if outcome:
        raise DomainError(outcome[1], code=outcome[0])
