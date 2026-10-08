from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit.services import security_event
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.marketplace.models import License, Order, OrderItem, ProductEntitlementTarget
from apps.marketplace.services import issue_license
from apps.payments.models import LedgerEntry, Payment, Refund, WebhookEvent

REFUND_WINDOW_DAYS = 14
TERMINAL = ("succeeded", "failed", "cancelled", "refunded")


# ------------------------------------------------------------------ initier un paiement
@transaction.atomic
def start_payment(user, order_id, provider: str) -> Payment:
    """Idempotent : un paiement 'initie' existant pour (commande, fournisseur) est renvoye tel quel."""
    order = Order.objects.select_for_update(of=("self",)).get(pk=order_id, user=user)
    if order.status != "pending":
        raise ConflictError("Cette commande n'est plus payable.", code="not_pending")
    if order.total_minor == 0:
        raise DomainError("Commande gratuite : utiliser pay_free_order.", code="free_order")
    if provider not in Payment.Provider.values:
        raise DomainError("Fournisseur inconnu.", code="invalid_provider")
    existing = Payment.objects.filter(order=order, provider=provider, status="initiated").first()
    if existing:
        return existing
    return Payment.objects.create(order=order, provider=provider, amount_minor=order.total_minor, currency=order.currency,
                                  provider_ref=f"{provider}-{uuid.uuid4().hex[:20]}" if provider == "manual" else "")


def attach_provider_ref(payment_id, provider_ref: str) -> Payment:
    """Appele apres l'ouverture de la session chez le fournisseur."""
    with transaction.atomic():
        p = Payment.objects.select_for_update(of=("self",)).get(pk=payment_id, status="initiated")
        p.provider_ref = provider_ref
        p.save(update_fields=["provider_ref", "updated_at"])
        return p


# ------------------------------------------------------------------ encaissement : commande payee + grand livre + licences + droits
def _entitlements_of(product) -> list[dict]:
    return [{"scope": t.scope, "target_id": str(t.target_id)} for t in ProductEntitlementTarget.objects.filter(product=product)]


def _settle(order: Order) -> None:
    """Appele sous verrou de la commande. Ecrit le LOT comptable (somme nulle), emet les licences, publie OrderPaid."""
    order.status, order.paid_at = "paid", timezone.now()
    order.save(update_fields=["status", "paid_at", "updated_at"])
    items = list(order.items.select_related("product", "store"))
    if order.total_minor > 0:
        batch = uuid.uuid4()
        entries = [LedgerEntry(batch=batch, order=order, account="buyer", kind="charge", amount_minor=-order.total_minor, currency=order.currency)]
        by_store: dict = {}
        fees = 0
        for it in items:
            by_store[it.store_id] = by_store.get(it.store_id, 0) + it.seller_net_minor
            fees += it.platform_fee_minor
        entries += [LedgerEntry(batch=batch, order=order, store_id=sid, account="seller", kind="charge", amount_minor=amt, currency=order.currency) for sid, amt in by_store.items() if amt]
        if fees:
            entries.append(LedgerEntry(batch=batch, order=order, account="platform", kind="charge", amount_minor=fees, currency=order.currency))
        LedgerEntry.objects.bulk_create(entries)
    payload_items = []
    for it in items:
        issue_license(it)
        payload_items.append({"item_id": str(it.pk), "product_id": str(it.product_id), "store_id": str(it.store_id), "entitlements": _entitlements_of(it.product)})
    publish_event("OrderPaid", "order", order.pk, {"buyer": str(order.user_id), "total": order.total_minor, "currency": order.currency, "items": payload_items,
                                                  "sellers": sorted({str(it.store.owner_id) for it in items}), "number": order.number})


@transaction.atomic
def pay_free_order(user, order_id) -> Order:
    order = Order.objects.select_for_update(of=("self",)).get(pk=order_id, user=user)
    if order.status == "paid":
        return order
    if order.status != "pending" or order.total_minor != 0:
        raise DomainError("Cette commande n'est pas gratuite.", code="not_free")
    _settle(order)
    return order


@transaction.atomic
def record_payment_result(provider: str, provider_ref: str, status: str, *, amount_minor: int, currency: str) -> Payment:
    """Point d'entree UNIQUE des resultats de paiement (webhooks). Idempotent ; recontrole montant et devise ; gere un paiement tardif."""
    if status not in ("succeeded", "failed", "cancelled"):
        raise DomainError("Statut de paiement inconnu.", code="invalid_status")
    payment = Payment.objects.select_for_update(of=("self",)).filter(provider=provider, provider_ref=provider_ref).first()
    if payment is None:
        raise DomainError("Paiement inconnu.", code="unknown_payment")
    if payment.status in TERMINAL:
        return payment  # rejeu : aucun effet
    order = Order.objects.select_for_update(of=("self",)).get(pk=payment.order_id)
    if status != "succeeded":
        payment.status = status
        payment.save(update_fields=["status", "updated_at"])
        return payment
    if amount_minor != payment.amount_minor or currency.upper() != payment.currency:
        payment.status, payment.failure_reason = "failed", f"amount_mismatch:{amount_minor}{currency}"
        payment.save(update_fields=["status", "failure_reason", "updated_at"])
        security_event(event_type="payment_amount_mismatch", severity="critical", data={"payment": str(payment.pk), "expected": payment.amount_minor, "received": amount_minor})
        return payment
    payment.status = "succeeded"
    payment.save(update_fields=["status", "updated_at"])
    if order.status == "pending":
        _settle(order)
    else:  # argent recu pour une commande annulee/deja traitee : a rembourser par un humain, jamais ignore en silence
        publish_event("PaymentOrphaned", "payment", payment.pk, {"order": str(order.pk), "order_status": order.status, "amount": payment.amount_minor})
        security_event(event_type="payment_orphaned", severity="warning", data={"payment": str(payment.pk), "order_status": order.status})
    return payment


def ingest_webhook(provider: str, body: bytes, signature: str) -> dict:
    """Webhook fournisseur : signature HMAC-SHA256 OBLIGATOIRE (secret vide => refus), deduplication par event_id, puis traitement."""
    secret = settings.PAYMENT_WEBHOOK_SECRETS.get(provider, "")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest() if secret else ""
    if not secret or not hmac.compare_digest(expected, (signature or "").lower()):
        security_event(event_type="webhook_bad_signature", severity="warning", data={"provider": provider})
        raise PermissionDeniedError("Signature invalide.", code="bad_signature")
    try:
        data = json.loads(body)
        event_id, ref, status = str(data["event_id"]), str(data["provider_ref"]), str(data["status"])
        amount, currency = int(data["amount_minor"]), str(data["currency"])
    except (ValueError, KeyError, TypeError) as exc:
        raise DomainError("Charge utile invalide.", code="invalid_payload") from exc
    try:
        with transaction.atomic():
            event = WebhookEvent.objects.create(provider=provider, event_id=event_id, payload=data)
    except IntegrityError:
        return {"duplicate": True}  # meme evenement recu deux fois : sans effet
    with transaction.atomic():
        record_payment_result(provider, ref, status, amount_minor=amount, currency=currency)
        WebhookEvent.objects.filter(pk=event.pk).update(processed_at=timezone.now())
    return {"duplicate": False}


# ------------------------------------------------------------------ remboursements
def _refundable(item: OrderItem) -> int:
    return item.line_total_minor - item.discount_minor - item.refunded_minor


@transaction.atomic
def request_refund(user, order_item_id, *, reason: str, amount_minor: int | None = None) -> Refund:
    item = OrderItem.objects.select_related("order").get(pk=order_item_id)
    order = item.order
    if order.user_id != user.pk and not user.is_staff:
        raise PermissionDeniedError("Commande d'un autre utilisateur.")
    if order.status not in ("paid", "partially_refunded"):
        raise DomainError("Cette commande n'est pas remboursable.", code="not_refundable")
    if not user.is_staff and timezone.now() - order.paid_at > timedelta(days=REFUND_WINDOW_DAYS):
        raise DomainError(f"Delai de remboursement ({REFUND_WINDOW_DAYS} jours) depasse.", code="refund_window_closed")
    remaining = _refundable(item)
    amount = remaining if amount_minor is None else amount_minor
    if not 0 < amount <= remaining:
        raise DomainError("Montant de remboursement invalide.", code="invalid_amount")
    payment = Payment.objects.filter(order=order, status="succeeded").first()
    if payment is None:
        raise DomainError("Aucun paiement a rembourser (commande gratuite).", code="no_payment")
    try:
        with transaction.atomic():
            return Refund.objects.create(payment=payment, order_item=item, amount_minor=amount, reason=reason, requested_by=user)
    except IntegrityError as exc:
        raise ConflictError("Une demande est deja en cours pour cet article.", code="refund_pending") from exc


@transaction.atomic
def process_refund(refund_id, *, by, approve: bool) -> Refund:
    """Decision d'un administrateur. Approbation = reversement comptable PROPORTIONNEL (acheteur recredite, vendeur et plateforme debites)."""
    if not by.is_staff:
        raise PermissionDeniedError("Reserve a l'administration.")
    refund = Refund.objects.select_for_update(of=("self",)).get(pk=refund_id)
    if refund.status != "requested":
        raise ConflictError("Demande deja traitee.", code="not_pending")
    refund.decided_by, refund.decided_at = by, timezone.now()
    if not approve:
        refund.status = "rejected"
        refund.save(update_fields=["status", "decided_by", "decided_at"])
        return refund
    payment = Payment.objects.select_for_update(of=("self",)).get(pk=refund.payment_id)
    order = Order.objects.select_for_update(of=("self",)).get(pk=payment.order_id)
    item = OrderItem.objects.select_for_update(of=("self",)).select_related("product", "store").get(pk=refund.order_item_id)
    if refund.amount_minor > _refundable(item):  # re-verifie SOUS verrou : deux remboursements ne peuvent pas depasser le paye
        raise DomainError("Le montant depasse le solde remboursable.", code="invalid_amount")
    paid = item.line_total_minor - item.discount_minor
    fee_part = refund.amount_minor * item.platform_fee_minor // paid
    seller_part = refund.amount_minor - fee_part
    batch = uuid.uuid4()
    entries = [LedgerEntry(batch=batch, order=order, account="buyer", kind="refund", amount_minor=refund.amount_minor, currency=order.currency)]
    if seller_part:
        entries.append(LedgerEntry(batch=batch, order=order, store=item.store, account="seller", kind="refund", amount_minor=-seller_part, currency=order.currency))
    if fee_part:
        entries.append(LedgerEntry(batch=batch, order=order, account="platform", kind="refund", amount_minor=-fee_part, currency=order.currency))
    LedgerEntry.objects.bulk_create(entries)
    item.refunded_minor += refund.amount_minor
    item.save(update_fields=["refunded_minor"])
    fully = _refundable(item) == 0
    if fully:
        lic = License.objects.select_for_update(of=("self",)).filter(order_item=item, status="active").first()
        if lic:  # formations et services n'ont pas de licence
            lic.status, lic.revoked_at = "revoked", timezone.now()
            lic.save(update_fields=["status", "revoked_at"])
    all_done = not any(_refundable(i) > 0 for i in order.items.all())
    order.status = "refunded" if all_done else "partially_refunded"
    order.save(update_fields=["status", "updated_at"])
    if all_done:
        payment.status = "refunded"
        payment.save(update_fields=["status", "updated_at"])
    refund.status = "processed"
    refund.save(update_fields=["status", "decided_by", "decided_at"])
    publish_event("OrderRefunded", "order", order.pk, {"buyer": str(order.user_id), "item_id": str(item.pk), "amount": refund.amount_minor, "currency": order.currency,
                                                       "fully_refunded_item": fully, "entitlements": _entitlements_of(item.product) if fully else []})
    return refund
