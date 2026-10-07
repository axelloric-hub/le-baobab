"""Correlation ID : propage X-Request-ID / genere un UUID, expose dans logs et audit."""
from __future__ import annotations

import contextvars
import hmac
import time
import uuid
import logging

correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="-")
_slow = logging.getLogger("baobab.slow")


def get_correlation_id() -> str:
    return correlation_id_var.get()


class CorrelationIdMiddleware:
    HEADER = "HTTP_X_REQUEST_ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        raw = request.META.get(self.HEADER, "")
        cid = raw if 8 <= len(raw) <= 64 and raw.replace("-", "").isalnum() else uuid.uuid4().hex
        token = correlation_id_var.set(cid)
        request.correlation_id = cid
        started = time.perf_counter()
        try:
            response = self.get_response(request)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            if elapsed_ms > 1000:
                _slow.warning("slow request %s %s %.0fms", request.method, request.path, elapsed_ms)
            correlation_id_var.reset(token)
        response["X-Request-ID"] = cid
        return response


class EdgeSecretMiddleware:
    """N'accepte que les requetes venant du Worker Cloudflare (secret partage). Sans cela, quiconque connait l'URL d'origine
    (xxx.onrender.com) contournerait WAF, limitation de debit et en-tetes de confiance. Desactive si EDGE_SHARED_SECRET est vide.
    /health/ reste ouvert (sonde de l'hebergeur) ; /internal/jobs/ a sa propre signature HMAC."""

    EXEMPT_PREFIXES = ("/health/", "/internal/jobs/")

    def __init__(self, get_response):
        from django.conf import settings

        self.get_response = get_response
        self.secret = settings.EDGE_SHARED_SECRET.encode()

    def __call__(self, request):
        if self.secret and not request.path.startswith(self.EXEMPT_PREFIXES):
            given = request.META.get("HTTP_X_EDGE_SECRET", "").encode()
            if not hmac.compare_digest(given, self.secret):
                from django.http import JsonResponse

                return JsonResponse({"error": {"code": "forbidden", "message": "Acces direct interdit."}}, status=403)
        return self.get_response(request)
