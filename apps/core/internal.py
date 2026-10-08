"""Declencheur de jobs planifies. Un cron trigger Cloudflare appelle POST /internal/jobs/<nom>/ ; la requete est signee
(HMAC-SHA256 sur "<timestamp>.<nom>") avec un secret partage Worker <-> conteneur, et refusee hors fenetre de 60 s (anti-rejeu).
Le routeur public ne route JAMAIS /internal/ ; le Worker API le bloque aussi pour le trafic externe (defense en profondeur)."""
from __future__ import annotations

import hashlib
import hmac
import io
import time

from django.conf import settings
from django.core.management import call_command
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

MAX_SKEW_SECONDS = 60
JOBS: dict[str, tuple[str, dict]] = {
    "relay-outbox": ("relay_outbox", {"once": True, "batch": 500}),
    "flush-counters": ("flush_counters", {}),
    "refresh-metrics": ("refresh_metrics", {"days": 2}),
    "refresh-trending": ("refresh_materialized_views", {}),
    "housekeeping": ("housekeeping", {}),
}


def sign(secret: str, timestamp: str, name: str) -> str:
    return hmac.new(secret.encode(), f"{timestamp}.{name}".encode(), hashlib.sha256).hexdigest()


class InternalJobView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]  # l'authentification est la signature HMAC, verifiee ci-dessous
    throttle_classes: list = []

    def post(self, request, name: str):
        if not self._authentic(request, name):
            return Response({"error": {"code": "forbidden", "message": "Acces refuse."}}, status=403)
        if name == "all":
            from apps.core.scheduler import default_jobs, run_due

            return Response({"job": "all", "executed": run_due(default_jobs(), {}, time.monotonic())})
        if name not in JOBS:
            return Response({"error": {"code": "unknown_job", "message": "Job inconnu."}}, status=404)
        command, kwargs = JOBS[name]
        out = io.StringIO()
        call_command(command, stdout=out, **kwargs)
        return Response({"job": name, "output": out.getvalue().strip()[:2000]})

    @staticmethod
    def _authentic(request, name: str) -> bool:
        """Deux modes : jeton fixe (Authorization: Bearer <CRON_JOB_TOKEN>, pour cron-job.org) OU signature HMAC datee (Worker)."""
        token = settings.CRON_JOB_TOKEN
        bearer = request.headers.get("Authorization", "")
        if token and len(token) >= 24 and bearer.startswith("Bearer "):
            return hmac.compare_digest(bearer[7:].encode(), token.encode())
        secret = settings.INTERNAL_JOB_SECRET
        ts = request.headers.get("X-Internal-Timestamp", "")
        sig = request.headers.get("X-Internal-Signature", "")
        try:
            fresh = abs(time.time() - int(ts)) <= MAX_SKEW_SECONDS
        except ValueError:
            fresh = False
        return bool(secret) and fresh and hmac.compare_digest(sig, sign(secret, ts, name))
