"""Publication/relais d'evenements de domaine (Transactional Outbox)."""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Callable

from django.db import transaction
from django.utils import timezone

from apps.core.middleware import get_correlation_id
from apps.core.models import OutboxEvent

log = logging.getLogger(__name__)
Handler = Callable[[OutboxEvent], None]
_HANDLERS: dict[str, list[Handler]] = {}
MAX_ATTEMPTS = 8


def publish_event(event_type: str, aggregate_type: str, aggregate_id: Any, payload: dict | None = None) -> OutboxEvent:
    """A appeler DANS la transaction metier. Refuse d'etre appele hors transaction."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("publish_event doit etre appele dans transaction.atomic()")
    return OutboxEvent.objects.create(
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=str(aggregate_id),
        payload=payload or {},
        correlation_id=get_correlation_id(),
    )


def subscribe(event_type: str) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        _HANDLERS.setdefault(event_type, []).append(fn)
        return fn

    return deco


def relay_batch(batch_size: int = 100) -> dict[str, int]:
    """Relaie un lot. SELECT ... FOR UPDATE SKIP LOCKED => plusieurs workers sans collision."""
    stats = {"processed": 0, "failed": 0, "retried": 0}
    with transaction.atomic():
        events = list(
            OutboxEvent.objects.select_for_update(skip_locked=True)
            .filter(status=OutboxEvent.Status.PENDING, available_at__lte=timezone.now())
            .order_by("id")[:batch_size]
        )
        for ev in events:
            try:
                for handler in _HANDLERS.get(ev.event_type, []):
                    handler(ev)
                ev.status, ev.processed_at = OutboxEvent.Status.PROCESSED, timezone.now()
                stats["processed"] += 1
            except Exception as exc:  # noqa: BLE001
                ev.attempts += 1
                ev.last_error = repr(exc)[:2000]
                log.exception("outbox handler failed event=%s", ev.event_id)
                if ev.attempts >= MAX_ATTEMPTS:
                    ev.status = OutboxEvent.Status.FAILED
                    stats["failed"] += 1
                else:
                    ev.available_at = timezone.now() + timedelta(seconds=2**ev.attempts)
                    stats["retried"] += 1
            ev.save(update_fields=["status", "processed_at", "attempts", "last_error", "available_at"])
    return stats
