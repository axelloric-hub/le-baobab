"""Paiements. Principes : (1) UN seul paiement reussi par commande, garanti par la base ; (2) le GRAND LIVRE est en ecriture seule
et chaque lot d'ecritures doit sommer a ZERO (verifie par un trigger differe : une transaction desequilibree ne peut pas etre validee) ;
(3) un webhook rejoue n'a aucun effet (WebhookEvent unique) ; (4) aucune confiance au montant annonce par le client : il est recontrole."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class Payment(UUIDModel):
    class Provider(models.TextChoices):
        MOBILE_MONEY = "mobile_money", "Mobile Money"
        CARD = "card", "Carte"
        MANUAL = "manual", "Manuel (virement, test)"

    class Status(models.TextChoices):
        INITIATED = "initiated", "Initie"
        SUCCEEDED = "succeeded", "Reussi"
        FAILED = "failed", "Echoue"
        CANCELLED = "cancelled", "Annule"
        REFUNDED = "refunded", "Rembourse"

    order = models.ForeignKey("marketplace.Order", on_delete=models.PROTECT, related_name="payments")
    provider = models.CharField(max_length=14, choices=Provider.choices)
    provider_ref = models.CharField(max_length=120, blank=True)  # identifiant cote fournisseur
    amount_minor = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.INITIATED)
    failure_reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "payments_payment"
        constraints = [
            models.CheckConstraint(condition=Q(amount_minor__gt=0), name="chk_payment_amount"),
            models.UniqueConstraint(fields=["provider", "provider_ref"], condition=~Q(provider_ref=""), name="uniq_payment_provider_ref"),
            # JAMAIS deux paiements reussis pour une meme commande (double paiement impossible)
            models.UniqueConstraint(fields=["order"], condition=Q(status="succeeded"), name="uniq_payment_one_success_per_order"),
        ]
        indexes = [models.Index(fields=["order", "-created_at"], name="payment_order_idx")]


class LedgerEntry(models.Model):
    """Grand livre a ecritures signees : montant > 0 = credit du compte, < 0 = debit. Un lot (batch) somme a zero."""

    class Account(models.TextChoices):
        BUYER = "buyer", "Acheteur"
        SELLER = "seller", "Vendeur"
        PLATFORM = "platform", "Plateforme"

    class Kind(models.TextChoices):
        CHARGE = "charge", "Encaissement"
        REFUND = "refund", "Remboursement"

    id = models.BigAutoField(primary_key=True)
    batch = models.UUIDField(default=uuid.uuid4)
    order = models.ForeignKey("marketplace.Order", on_delete=models.PROTECT, related_name="ledger")
    store = models.ForeignKey("marketplace.Store", null=True, blank=True, on_delete=models.PROTECT, related_name="ledger")
    account = models.CharField(max_length=8, choices=Account.choices)
    kind = models.CharField(max_length=8, choices=Kind.choices)
    amount_minor = models.BigIntegerField()
    currency = models.CharField(max_length=3)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "payments_ledger_entry"
        constraints = [models.CheckConstraint(condition=~Q(amount_minor=0), name="chk_ledger_nonzero"),
                       models.CheckConstraint(condition=Q(account="seller", store__isnull=False) | ~Q(account="seller"), name="chk_ledger_seller_store")]
        indexes = [models.Index(fields=["batch"], name="ledger_batch_idx"), models.Index(fields=["store", "-created_at"], name="ledger_store_idx", condition=Q(store__isnull=False)),
                   models.Index(fields=["order"], name="ledger_order_idx")]


class Refund(UUIDModel):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Demande"
        PROCESSED = "processed", "Effectue"
        REJECTED = "rejected", "Refuse"

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    order_item = models.ForeignKey("marketplace.OrderItem", on_delete=models.PROTECT, related_name="refunds")
    amount_minor = models.PositiveBigIntegerField()
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.REQUESTED)
    requested_by = models.ForeignKey(U, on_delete=models.PROTECT, related_name="refunds_requested")
    decided_by = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="refunds_decided")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments_refund"
        constraints = [models.CheckConstraint(condition=Q(amount_minor__gt=0), name="chk_refund_amount"),
                       models.CheckConstraint(condition=Q(status="requested") | Q(decided_at__isnull=False), name="chk_refund_decided_dated"),
                       # une seule demande ouverte par ligne de commande
                       models.UniqueConstraint(fields=["order_item"], condition=Q(status="requested"), name="uniq_refund_open_per_item")]


class WebhookEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    provider = models.CharField(max_length=14)
    event_id = models.CharField(max_length=120)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "payments_webhook_event"
        constraints = [models.UniqueConstraint(fields=["provider", "event_id"], name="uniq_webhook_event")]  # rejeu = sans effet
