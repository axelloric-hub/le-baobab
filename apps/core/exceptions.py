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


class RateLimitedError(DomainError):
    code = "rate_limited"
    status_code = 429


def api_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response({"error": {"code": exc.code, "message": exc.message}}, status=exc.status_code)
    return exception_handler(exc, context)
