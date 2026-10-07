"""Modeles abstraits partages + Outbox + Idempotence (transverses a tous les domaines)."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class UUIDModel(models.Model):
    """PK UUID : pas d'enumeration d'IDs, fusionnable/shardable, generable cote client."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """created_at / updated_at. updated_at est AUSSI maintenu par un trigger SQL
    (baobab_set_updated_at) pour couvrir les UPDATE hors ORM (bulk, SQL brut, scripts)."""

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)


class SoftDeleteModel(models.Model):
    """Soft delete reserve aux CONTENUS (posts, commentaires, messages). Jamais pour la finance."""

    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    deletion_reason = models.CharField(max_length=255, blank=True)

    objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class OutboxEvent(models.Model):
    """Transactional Outbox : l'evenement est ecrit DANS la meme transaction que la donnee metier.
    Un worker (`manage.py relay_outbox`) le relaie ensuite vers Mongo / Redis pub-sub / notifications.
    Garantie : at-least-once -> les consommateurs DOIVENT etre idempotents (utiliser `event_id`)."""

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        PROCESSED = "processed", "Traite"
        FAILED = "failed", "Echec"

    id = models.BigAutoField(primary_key=True)  # ordre total de relais
    event_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    event_type = models.CharField(max_length=100)  # ex: PostCreated
    aggregate_type = models.CharField(max_length=60)
    aggregate_id = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    correlation_id = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    available_at = models.DateTimeField(default=timezone.now)  # backoff
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "core_outbox_event"
        indexes = [
            # Hot path du relais : "prochains evenements a traiter". Index PARTIEL => reste minuscule.
            models.Index(
                fields=["available_at", "id"],
                name="outbox_pending_idx",
                condition=models.Q(status="pending"),
            ),
            models.Index(fields=["aggregate_type", "aggregate_id"], name="outbox_aggregate_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.event_type}#{self.id} [{self.status}]"


class IdempotencyRecord(models.Model):
    """Etat DEFINITIF d'une operation idempotente (paiement, webhook, commande...).
    Redis ne garde qu'un verrou court ; la verite est ici (survit a l'eviction)."""

    class Status(models.TextChoices):
        STARTED = "started", "En cours"
        COMPLETED = "completed", "Termine"
        FAILED = "failed", "Echec"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scope = models.CharField(max_length=60)  # ex: payment.create, webhook.stripe
    key = models.CharField(max_length=200)
    request_hash = models.CharField(max_length=64, blank=True)  # detecte la reutilisation d'une cle avec un autre corps
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.STARTED)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "core_idempotency_record"
        constraints = [models.UniqueConstraint(fields=["scope", "key"], name="uniq_idem_scope_key")]
        indexes = [models.Index(fields=["expires_at"], name="idem_expires_idx")]
