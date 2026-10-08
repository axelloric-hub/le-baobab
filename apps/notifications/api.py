from __future__ import annotations

from rest_framework import serializers as s

from apps.core.api import endpoint, paginate
from apps.notifications import services as NV
from apps.notifications.models import Notification, NotificationPreference, NotificationType
from apps.profiles.render import user_brief


def _n(n: Notification) -> dict:
    return {"id": str(n.pk), "type": n.type_id, "actor": user_brief(n.actor) if n.actor_id else None, "target_type": n.target_type, "target_id": str(n.target_id) if n.target_id else None,
            "data": n.data, "read": n.read_at is not None, "created_at": n.created_at}


@endpoint("Mes notifications (les plus recentes d'abord).", query={"unread": s.BooleanField(default=False)})
def list_notifications(request):
    qs = Notification.objects.filter(recipient=request.user).select_related("actor__profile")
    if request.q["unread"]:
        qs = qs.filter(read_at__isnull=True)
    return paginate(request, qs, ("-created_at", "-id"), _n, 30)


@endpoint("Nombre de notifications non lues (cache Redis, O(1)).")
def unread_count(request):
    return {"unread": NV.unread_count(request.user.pk)}


@endpoint("Marquer comme lues (ids facultatif : sans liste, toutes).", body={"ids": s.ListField(child=s.UUIDField(), required=False, max_length=200)})
def mark_read(request):
    return {"marked": NV.mark_read(request.user, request.input.get("ids"))}


@endpoint("Mes preferences de notification.")
def preferences(request):
    return {"types": [{"code": t.code, "category": t.category, "critical": t.is_critical} for t in NotificationType.objects.filter(is_active=True)],
            "preferences": [{"type": p.type_id, "channel": p.channel, "enabled": p.enabled} for p in NotificationPreference.objects.filter(user=request.user)]}


@endpoint("Activer/desactiver un canal (in_app, websocket, email, push) pour un type (ou tous).", body={"type": s.CharField(required=False, allow_null=True, max_length=50),
                                                                                                     "channel": s.ChoiceField(choices=["in_app", "websocket", "email", "push"]), "enabled": s.BooleanField()})
def set_preference(request):
    d = request.input
    p = NV.set_preference(request.user, d.get("type"), d["channel"], d["enabled"])
    return {"type": p.type_id, "channel": p.channel, "enabled": p.enabled}
