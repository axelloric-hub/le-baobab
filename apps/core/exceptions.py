from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import exception_handler


class DomainError(Exception):
    """Erreur metier (422) levee par les services ; jamais de details internes."""

    code = "domain_error"
    status_code = 422

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class ConflictError(DomainError):
    code = "conflict"
    status_code = 409


class PermissionDeniedError(DomainError):
    code = "forbidden"
    status_code = 403


class IdempotencyConflictError(ConflictError):
    code = "idempotency_conflict"


class InvalidCredentialsError(DomainError):
    code = "invalid_credentials"
    status_code = 401


class RateLimitedError(DomainError):
    code = "rate_limited"
    status_code = 429


def api_exception_handler(exc, context):
    """Format d'erreur UNIQUE pour tout le frontend : {"error": {"code", "message", "fields"?}}."""
    from django.core.exceptions import ObjectDoesNotExist
    from django.http import Http404
    from rest_framework import exceptions as drf

    if isinstance(exc, DomainError):
        return Response({"error": {"code": exc.code, "message": exc.message}}, status=exc.status_code)
    if isinstance(exc, (ObjectDoesNotExist, Http404)):
        return Response({"error": {"code": "not_found", "message": "Ressource introuvable."}}, status=404)
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, drf.ValidationError):
        response.data = {"error": {"code": "validation_error", "message": "Donnees invalides.", "fields": exc.detail}}
    else:
        codes = {401: "not_authenticated", 403: "forbidden", 404: "not_found", 405: "method_not_allowed", 429: "rate_limited"}
        detail = response.data.get("detail") if isinstance(response.data, dict) else None
        response.data = {"error": {"code": codes.get(response.status_code, "error"), "message": str(detail or "Erreur.")}}
    return response


class PaymentRequiredError(PermissionDeniedError):
    """Contenu payant non debloque : 402, avec en `code` la raison exacte (payment_required, classroom_payment_required)."""

    code = "payment_required"
    status_code = 402
