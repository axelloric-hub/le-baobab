from __future__ import annotations

from contextlib import contextmanager
from typing import Any

from django.db import connection, transaction

from apps.audit.models import AdminAction, AuditLog, SecurityEvent, SystemEvent
from apps.core.middleware import get_correlation_id


@contextmanager
def audit_context(actor_id=None, ip: str | None = None):
    """Expose acteur/IP aux triggers SQL (set_config local a la transaction) et RESTAURE l'etat precedent a la sortie :
    sans cela, dans une transaction englobante, l'acteur fuirait vers des operations ulterieures d'un autre contexte."""
    names = ("baobab.actor_id", "baobab.ip", "baobab.correlation_id")
    with transaction.atomic():
        with connection.cursor() as cur:
            cur.execute("SELECT " + ", ".join("COALESCE(current_setting(%s, true), '')" for _ in names), list(names))
            previous = cur.fetchone()
            cur.execute("SELECT set_config('baobab.actor_id', %s, true), set_config('baobab.ip', %s, true), set_config('baobab.correlation_id', %s, true)",
                        [str(actor_id) if actor_id else "", ip or "", get_correlation_id()])
        try:
            yield
        finally:
            with connection.cursor() as cur:
                cur.execute("SELECT " + ", ".join("set_config(%s, %s, true)" for _ in names),
                            [v for pair in zip(names, previous) for v in pair])


def record(*, actor, action: str, object_type: str, object_id: Any, old: dict | None = None, new: dict | None = None,
           ip: str | None = None, user_agent: str = "") -> AuditLog:
    return AuditLog.objects.create(
        actor=actor if getattr(actor, "pk", None) else None, actor_label=getattr(actor, "username", "") or "system",
        action=action, object_type=object_type, object_id=str(object_id), old_values=old, new_values=new,
        source="app", ip_address=ip, user_agent=user_agent[:400], correlation_id=get_correlation_id() if get_correlation_id() != "-" else "",
    )


def admin_action(*, admin, action: str, target_type: str, target_id: Any, reason: str, payload: dict | None = None) -> AdminAction:
    record(actor=admin, action=f"admin.{action}", object_type=target_type, object_id=target_id, new=payload)
    return AdminAction.objects.create(admin=admin, action=action, target_type=target_type, target_id=str(target_id), reason=reason, payload=payload or {})


def security_event(*, event_type: str, user=None, severity: str = SecurityEvent.Severity.INFO, ip: str | None = None, data: dict | None = None) -> SecurityEvent:
    cid = get_correlation_id()
    return SecurityEvent.objects.create(user=user, event_type=event_type, severity=severity, ip_address=ip, data=data or {}, correlation_id="" if cid == "-" else cid)


def system_event(*, component: str, message: str, level: str = SystemEvent.Level.INFO, data: dict | None = None) -> SystemEvent:
    return SystemEvent.objects.create(component=component, message=message[:500], level=level, data=data or {})
