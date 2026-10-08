"""Paiements. AUCUN fournisseur n'est branche : le webhook est pret (signature HMAC), et un endpoint de SIMULATION (desactive par defaut) permet de tester le parcours d'achat."""
from __future__ import annotations

from django.conf import settings
from rest_framework import serializers as s
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.api import endpoint, get_or_404, paginate
from apps.marketplace.models import Order
from apps.marketplace.serializers import OrderSerializer
from apps.payments import services as P
from apps.payments.models import LedgerEntry, Payment, Refund
from apps.payments.serializers import PaymentSerializer, RefundSerializer


@endpoint("Initier le paiement d'une de mes commandes (idempotent). Le fournisseur reel n'est pas branche : voir /payments/{id}/simulate/ en phase de test.", status=201,
          body={"order": s.UUIDField(), "provider": s.ChoiceField(choices=[c[0] for c in Payment.Provider.choices])})
def start(request):
    pay = P.start_payment(request.user, request.input["order"], request.input["provider"])
    return {**PaymentSerializer(pay).data, "provider_ref": pay.provider_ref}


@endpoint("[PHASE DE TEST] Simuler le resultat d'un paiement 'manual' (reussite ou echec). Retourne 404 si PAYMENTS_SIMULATION_ENABLED est desactive.", body={"outcome": s.ChoiceField(choices=["succeeded", "failed"], default="succeeded")})
def simulate(request, payment_id):
    if not settings.PAYMENTS_SIMULATION_ENABLED:
        raise NotFound()
    pay = get_or_404(Payment.objects.filter(pk=payment_id, order__user=request.user, provider="manual"))
    done = P.record_payment_result("manual", pay.provider_ref, request.input["outcome"], amount_minor=pay.amount_minor, currency=pay.currency)
    return {"payment": PaymentSerializer(done).data, "order": OrderSerializer(Order.objects.prefetch_related("items").get(pk=pay.order_id)).data}


@endpoint("Valider une commande GRATUITE (total 0).")
def pay_free(request, order_id):
    return OrderSerializer(Order.objects.prefetch_related("items").get(pk=P.pay_free_order(request.user, order_id).pk)).data


@endpoint("Webhook d'un fournisseur de paiement. Corps JSON brut {event_id, provider_ref, status, amount_minor, currency} + en-tete X-Signature = HMAC-SHA256 hexadecimal du corps avec le secret du fournisseur. Idempotent.", auth="public")
def webhook(request, provider):
    return P.ingest_webhook(provider, request.body, request.headers.get("X-Signature", ""))


@endpoint("Demander un remboursement (delai de 14 jours ; une demande ouverte par article).", status=201, body={"order_item": s.UUIDField(), "reason": s.CharField(max_length=500), "amount_minor": s.IntegerField(min_value=1, required=False)})
def request_refund(request):
    d = request.input
    from apps.marketplace.models import OrderItem

    get_or_404(OrderItem.objects.filter(pk=d["order_item"], order__user=request.user))
    return RefundSerializer(P.request_refund(request.user, d["order_item"], reason=d["reason"], amount_minor=d.get("amount_minor"))).data


@endpoint("Mes demandes de remboursement.")
def my_refunds(request):
    return paginate(request, Refund.objects.filter(requested_by=request.user), ("-created_at", "-id"), lambda r: RefundSerializer(r).data, 20)


@endpoint("[Administration] File des remboursements.", auth="staff", query={"status": s.ChoiceField(choices=["requested", "processed", "rejected"], default="requested")})
def admin_refunds(request):
    return paginate(request, Refund.objects.filter(status=request.q["status"]), ("-created_at", "-id"), lambda r: RefundSerializer(r).data, 30)


@endpoint("[Administration] Approuver ou refuser un remboursement (reversement comptable proportionnel, licence et acces retires).", auth="staff", body={"approve": s.BooleanField()})
def decide_refund(request, refund_id):
    return RefundSerializer(P.process_refund(refund_id, by=request.user, approve=request.input["approve"])).data


@endpoint("[Administration] Ecritures du grand livre d'une commande (le solde doit valoir 0).", auth="staff")
def ledger(request, order_id):
    from django.db import connection

    with connection.cursor() as cur:
        cur.execute("SELECT baobab_order_ledger_balance(%s)", [order_id])
        bal = cur.fetchone()[0]
    return {"balance": bal, "entries": [{"account": e.account, "kind": e.kind, "amount_minor": e.amount_minor, "currency": e.currency, "created_at": e.created_at} for e in LedgerEntry.objects.filter(order_id=order_id).order_by("id")]}
