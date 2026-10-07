"""Notifications. PostgreSQL = verite (liste, etat lu, preferences, livraisons). Redis = compteur 'non lus' + push WebSocket.
NotificationChannel est une enumeration (TextChoices), pas une table : l'ensemble des canaux est du code, pas de la donnee."""
from __future__ import annotations

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class NotificationChannel(models.TextChoices):
    IN_APP = "in_app", "Dans l'application"
    WEBSOCKET = "websocket", "Temps reel"
    EMAIL = "email", "Email"
    PUSH = "push", "Push mobile/web"
    TELEGRAM = "telegram", "Telegram"


class NotificationType(models.Model):
    code = models.CharField(max_length=50, primary_key=True)  # friend_request, comment, mention, job_match...
    category = models.CharField(max_length=30)  # social, messaging, learning, commerce, jobs, system
    description = models.CharField(max_length=200, blank=True)
    default_channels = ArrayField(models.CharField(max_length=10, choices=NotificationChannel.choices), default=list)
    is_critical = models.BooleanField(default=False)  # securite/paiement : ne peut pas etre desactive
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "notifications_type"

    def __str__(self) -> str:
        return self.code


class NotificationTemplate(models.Model):
    id = models.BigAutoField(primary_key=True)
    type = models.ForeignKey(NotificationType, on_delete=models.CASCADE, related_name="templates")
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices)
    language = models.CharField(max_length=8, default="fr")
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()  # format str.format avec les cles de Notification.data

    class Meta:
        db_table = "notifications_template"
        constraints = [models.UniqueConstraint(fields=["type", "channel", "language"], name="uniq_notif_template")]


class NotificationPreference(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="notification_preferences")
    type = models.ForeignKey(NotificationType, null=True, blank=True, on_delete=models.CASCADE, related_name="+")  # NULL = tous types
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices)
    enabled = models.BooleanField(default=True)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications_preference"
        constraints = [
            models.UniqueConstraint(fields=["user", "type", "channel"], name="uniq_notif_pref", nulls_distinct=False),
        ]


class Notification(UUIDModel):
    recipient = models.ForeignKey(U, on_delete=models.CASCADE, related_name="notifications")
    type = models.ForeignKey(NotificationType, on_delete=models.PROTECT, related_name="+")
    actor = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(max_length=120, blank=True)  # evite 50 notifications 'X a aime' pour le meme objet
    seen_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "notifications_notification"
        constraints = [models.UniqueConstraint(fields=["recipient", "dedupe_key"], condition=~Q(dedupe_key=""), name="uniq_notification_dedupe")]
        indexes = [
            models.Index(fields=["recipient", "-created_at", "-id"], name="notif_inbox_idx"),
            models.Index(fields=["recipient", "-created_at"], name="notif_unread_idx", condition=Q(read_at__isnull=True)),
        ]


class NotificationDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        SENT = "sent", "Envoye"
        FAILED = "failed", "Echec"
        SKIPPED = "skipped", "Ignore (preferences)"

    id = models.BigAutoField(primary_key=True)
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="deliveries")
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    provider_message_id = models.CharField(max_length=200, blank=True)
    error = models.CharField(max_length=500, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "notifications_delivery"
        constraints = [models.UniqueConstraint(fields=["notification", "channel"], name="uniq_delivery_channel")]  # idempotence
        indexes = [models.Index(fields=["channel", "created_at"], name="delivery_pending_idx", condition=Q(status="pending"))]
