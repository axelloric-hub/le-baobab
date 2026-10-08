"""Etat du systeme pour les administrateurs : interrupteurs de test encore actifs, quota d'e-mails OTP du jour, configuration du stockage."""
from __future__ import annotations

from django.conf import settings

from apps.accounts.otp import emails_sent_today
from apps.core.api import endpoint, route
from apps.core.checks import active_test_flags


@endpoint("[Administration] Etat du systeme : interrupteurs de TEST encore actifs (a couper avant la production), quota d'e-mails OTP, SMTP et stockage.", auth="staff")
def system_status(request):
    flags = active_test_flags()
    return {"production_ready": not flags, "test_flags_active": [{"flag": k, "risk": v} for k, v in flags.items()],
            "otp": {"emails_sent_today": emails_sent_today(), "daily_limit": settings.OTP_EMAIL_DAILY_LIMIT, "smtp_configured": bool(settings.EMAIL_HOST)},
            "storage": {"backend": settings.STORAGE_BACKEND, "bucket_configured": bool(settings.STORAGE_BUCKET and settings.STORAGE_ACCESS_KEY_ID)},
            "jwt_access_lifetime_minutes": int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds() // 60)}


urlpatterns = [route("admin/system/status/", GET=system_status)]
