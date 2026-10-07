"""Collecte d'evenements analytiques -> MongoDB (jamais dans les tables transactionnelles).
Valide l'evenement contre le catalogue EventType (contrat) avant ecriture."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from apps.analytics.models import EventType
from apps.core.mongo import collection

EVENTS = "events"


def track(event_type: str, *, actor_id=None, target_type: str = "", target_id=None, metadata: dict[str, Any] | None = None,
          occurred_at: datetime | None = None, event_id: str | None = None) -> bool:
    """Retourne False si type inconnu/inactif. `event_id` rend l'ecriture idempotente (relais outbox at-least-once)."""
    et = EventType.objects.filter(pk=event_type, is_active=True).first()
    if et is None:
        return False
    if et.actor_required and actor_id is None:
        raise ValueError(f"{event_type} exige un acteur")
    now = occurred_at or timezone.now()
    doc = {
        "type": event_type, "domain": et.domain,
        "actor": {"id": str(actor_id)} if actor_id else None,
        "target": {"type": target_type, "id": str(target_id)} if target_type else None,
        "meta": metadata or {}, "ts": now, "expires_at": now + timedelta(days=et.retention_days), "schema_version": 1,
    }
    if event_id:
        collection(EVENTS).replace_one({"_id": event_id}, {**doc, "_id": event_id}, upsert=True)
    else:
        collection(EVENTS).insert_one(doc)
    return True
