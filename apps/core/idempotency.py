"""Idempotence en deux couches : Redis (verrou court anti-double-clic) + PostgreSQL (etat definitif)."""
from __future__ import annotations

import hashlib
import json
from datetime import timedelta
from typing import Any, Callable

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core import redis as R
from apps.core.exceptions import ConflictError, IdempotencyConflictError
from apps.core.models import IdempotencyRecord


def hash_request(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def run_idempotent(scope: str, key: str, payload: Any, operation: Callable[[], dict], ttl_hours: int = 24) -> dict:
    """Execute `operation` AU PLUS UNE FOIS par (scope,key). Rejoue la reponse enregistree sinon.
    `operation` s'execute dans la meme transaction que l'enregistrement du resultat."""
    rhash = hash_request(payload)
    existing = IdempotencyRecord.objects.filter(scope=scope, key=key).first()
    if existing:
        return _replay(existing, rhash)

    state, _ = R.idempotency_acquire(scope, key, rhash)
    if state == "mismatch":
        raise IdempotencyConflictError("Cle d'idempotence reutilisee avec un contenu different.")
    if state == "in_progress":
        raise ConflictError("Operation deja en cours.", code="in_progress")
    try:
        with transaction.atomic():
            try:
                rec = IdempotencyRecord.objects.create(
                    scope=scope, key=key, request_hash=rhash, expires_at=timezone.now() + timedelta(hours=ttl_hours)
                )
            except IntegrityError:  # course perdue : un autre process a gagne
                return _replay(IdempotencyRecord.objects.get(scope=scope, key=key), rhash)
            result = operation()
            rec.status, rec.response_status, rec.response_body = IdempotencyRecord.Status.COMPLETED, 200, result
            rec.save(update_fields=["status", "response_status", "response_body"])
    except Exception:
        R.idempotency_release(scope, key)
        raise
    R.idempotency_complete(scope, key, rhash, result)
    return result


def _replay(rec: IdempotencyRecord, rhash: str) -> dict:
    if rec.request_hash != rhash:
        raise IdempotencyConflictError("Cle d'idempotence reutilisee avec un contenu different.")
    if rec.status != IdempotencyRecord.Status.COMPLETED:
        raise ConflictError("Operation deja en cours.", code="in_progress")
    return rec.response_body or {}
