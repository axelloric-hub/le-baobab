from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.core import redis as R
from apps.core import redis_keys as K
from apps.friends.selectors import is_blocked_either_way
from apps.notifications.models import Notification, NotificationChannel, NotificationDelivery, NotificationPreference, NotificationType


def _channel_enabled(user_id, ntype: NotificationType, channel: str) -> bool:
    if ntype.is_critical:
        return True
    prefs = {(p.type_id, p.channel): p.enabled for p in NotificationPreference.objects.filter(user_id=user_id, channel=channel).filter(Q(type_id=ntype.pk) | Q(type__isnull=True))}
    if (ntype.pk, channel) in prefs:  # la preference specifique l'emporte sur la generale
        return prefs[(ntype.pk, channel)]
    return prefs.get((None, channel), channel in ntype.default_channels)


@transaction.atomic
def notify(*, recipient, type_code: str, actor=None, target_type: str = "", target_id=None, data: dict | None = None, dedupe_key: str = "") -> Notification | None:
    """Cree la notification in-app (verite) et les lignes de livraison par canal actif. Retourne None si ignoree
    (auto-notification, blocage, doublon). La diffusion temps reel/Redis part APRES commit."""
    if actor is not None and (actor.pk == recipient.pk or is_blocked_either_way(actor.pk, recipient.pk)):
        return None
    ntype = NotificationType.objects.get(pk=type_code, is_active=True)
    if not _channel_enabled(recipient.pk, ntype, NotificationChannel.IN_APP):
        return None
    try:
        with transaction.atomic():
            n = Notification.objects.create(recipient=recipient, type=ntype, actor=actor, target_type=target_type, target_id=target_id, data=data or {}, dedupe_key=dedupe_key)
    except IntegrityError:
        return None
    for ch in set(ntype.default_channels) - {NotificationChannel.IN_APP}:
        NotificationDelivery.objects.create(notification=n, channel=ch, status=NotificationDelivery.Status.PENDING if _channel_enabled(recipient.pk, ntype, ch) else NotificationDelivery.Status.SKIPPED)
    transaction.on_commit(lambda: _push_realtime(n))
    return n


def _push_realtime(n: Notification) -> None:
    try:
        R.get_redis().incr(K.user_notifications_unread(n.recipient_id))
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(f"user.{n.recipient_id}", {"type": "notify", "id": str(n.pk), "code": n.type_id, "data": n.data})
    except Exception:  # noqa: BLE001 - best effort
        import logging
        logging.getLogger(__name__).warning("notification realtime push failed", exc_info=True)


def unread_count(user_id) -> int:
    """Compteur Redis (rapide) ; reconstruit depuis PostgreSQL si absent (eviction/restart)."""
    r = R.get_redis()
    key = K.user_notifications_unread(user_id)
    v = r.get(key)
    if v is None:
        n = Notification.objects.filter(recipient_id=user_id, read_at__isnull=True).count()
        r.set(key, n, ex=K.TTL_UNREAD)
        return n
    return max(int(v), 0)


@transaction.atomic
def mark_read(user, notification_ids=None) -> int:
    qs = Notification.objects.filter(recipient=user, read_at__isnull=True)
    if notification_ids:
        qs = qs.filter(pk__in=notification_ids)
    updated = qs.update(read_at=timezone.now(), seen_at=timezone.now())
    if updated:
        transaction.on_commit(lambda: R.get_redis().delete(K.user_notifications_unread(user.pk)))  # reconstruit a la prochaine lecture
    return updated


def set_preference(user, type_code: str | None, channel: str, enabled: bool):
    """Active/desactive un canal pour un type (ou pour tous si type_code est None). Les types critiques (securite, paiement) ne se desactivent pas."""
    from apps.core.exceptions import DomainError
    from apps.notifications.models import NotificationPreference, NotificationType

    ntype = None
    if type_code is not None:
        ntype = NotificationType.objects.filter(code=type_code, is_active=True).first()
        if ntype is None:
            raise DomainError("Type de notification inconnu.", code="unknown_type")
        if ntype.is_critical and not enabled:
            raise DomainError("Cette notification est critique et ne peut pas etre desactivee.", code="critical_notification")
    pref = NotificationPreference.objects.filter(user=user, type=ntype, channel=channel).first()
    if pref:
        pref.enabled = enabled
        pref.save(update_fields=["enabled"])
        return pref
    return NotificationPreference.objects.create(user=user, type=ntype, channel=channel, enabled=enabled)
