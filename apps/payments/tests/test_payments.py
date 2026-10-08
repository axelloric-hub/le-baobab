import hashlib
import hmac
import json
import threading
from datetime import timedelta

from django.db import IntegrityError, connection, connections, transaction
from django.test import override_settings
from django.utils import timezone

from apps.core import outbox
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError, RateLimitedError
from apps.core.models import OutboxEvent
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.education import services as E
from apps.education.access import access_decision
from apps.education.models import Chapter
from apps.education.testing import make_course
from apps.marketplace import services as M
from apps.marketplace.models import Download, License
from apps.marketplace.testing import make_shop, second_product
from apps.notifications.models import Notification
from apps.payments import services as P
from apps.payments.models import LedgerEntry, Payment, Refund, WebhookEvent

SECRET = "w" * 32


def staff():
    u = make_user(); u.is_staff = True; u.save()
    return u


def paid_order(shop, buyer, qty=1, key="k", coupon=""):
    M.add_to_cart(buyer, shop.variant.pk, qty)
    order = M.checkout(buyer, idempotency_key=key, coupon_code=coupon)
    pay = P.start_payment(buyer, order.pk, "manual")
    P.record_payment_result("manual", pay.provider_ref, "succeeded", amount_minor=pay.amount_minor, currency=pay.currency)
    order.refresh_from_db()
    return order, pay


class SettlementTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.shop = make_shop(price=10_000)
        self.buyer = make_user()

    def test_payment_settles_order_writes_a_balanced_ledger_and_issues_a_license(self):
        order, _ = paid_order(self.shop, self.buyer, qty=2)
        self.assertEqual((order.status, order.total_minor), ("paid", 20_000))
        entries = {(e.account, e.kind): e.amount_minor for e in LedgerEntry.objects.filter(order=order)}
        self.assertEqual(entries, {("buyer", "charge"): -20_000, ("seller", "charge"): 18_000, ("platform", "charge"): 2_000})
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_order_ledger_balance(%s)", [order.pk])
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("SELECT seller_gross, seller_refunds, seller_net FROM baobab_store_revenue(%s)", [self.shop.store.pk])
            self.assertEqual(cur.fetchone(), (18_000, 0, 18_000))
        lic = License.objects.get(user=self.buyer)
        self.assertEqual((lic.seats, lic.status, lic.key[:4]), (2, "active", "BAO-"))

    def test_start_payment_is_idempotent_and_guards_state(self):
        M.add_to_cart(self.buyer, self.shop.variant.pk)
        o = M.checkout(self.buyer, idempotency_key="a")
        p1, p2 = P.start_payment(self.buyer, o.pk, "manual"), P.start_payment(self.buyer, o.pk, "manual")
        self.assertEqual(p1.pk, p2.pk)
        with self.assertRaises(DomainError):
            P.start_payment(self.buyer, o.pk, "bitcoin")
        with self.assertRaises(Exception):
            P.start_payment(make_user(), o.pk, "manual")  # commande d'un autre
        M.cancel_order(o.pk, by=self.buyer)
        with self.assertRaises(ConflictError):
            P.start_payment(self.buyer, o.pk, "manual")

    def test_result_is_idempotent_and_replay_has_no_effect(self):
        order, pay = paid_order(self.shop, self.buyer)
        n = LedgerEntry.objects.count()
        for _ in range(3):
            P.record_payment_result("manual", pay.provider_ref, "succeeded", amount_minor=pay.amount_minor, currency="XAF")
        self.assertEqual((LedgerEntry.objects.count(), License.objects.count(), OutboxEvent.objects.filter(event_type="OrderPaid").count()), (n, 1, 1))

    def test_wrong_amount_or_currency_is_rejected_and_flagged(self):
        M.add_to_cart(self.buyer, self.shop.variant.pk)
        o = M.checkout(self.buyer, idempotency_key="a")
        pay = P.start_payment(self.buyer, o.pk, "manual")
        res = P.record_payment_result("manual", pay.provider_ref, "succeeded", amount_minor=1, currency="XAF")  # on essaie de payer 1 au lieu de 10 000
        o.refresh_from_db()
        self.assertEqual((res.status, o.status, res.failure_reason.startswith("amount_mismatch")), ("failed", "pending", True))
        from apps.audit.models import SecurityEvent
        self.assertTrue(SecurityEvent.objects.filter(event_type="payment_amount_mismatch", severity="critical").exists())
        self.assertFalse(LedgerEntry.objects.exists())

    def test_database_allows_only_one_successful_payment_per_order(self):
        order, pay = paid_order(self.shop, self.buyer)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.create(order=order, provider="card", provider_ref="other", amount_minor=pay.amount_minor, currency="XAF", status="succeeded")

    def test_payment_arriving_after_cancellation_is_flagged_not_silently_lost(self):
        M.add_to_cart(self.buyer, self.shop.variant.pk)
        o = M.checkout(self.buyer, idempotency_key="a")
        pay = P.start_payment(self.buyer, o.pk, "manual")
        M.cancel_order(o.pk, by=self.buyer)
        P.record_payment_result("manual", pay.provider_ref, "succeeded", amount_minor=pay.amount_minor, currency="XAF")
        o.refresh_from_db()
        self.assertEqual(o.status, "cancelled")
        self.assertTrue(OutboxEvent.objects.filter(event_type="PaymentOrphaned").exists())
        self.assertFalse(License.objects.exists())

    def test_free_order_needs_no_payment(self):
        shop = make_shop(price=0)
        M.add_to_cart(self.buyer, shop.variant.pk)
        o = M.checkout(self.buyer, idempotency_key="free")
        with self.assertRaises(DomainError):
            P.start_payment(self.buyer, o.pk, "manual")
        self.assertEqual(P.pay_free_order(self.buyer, o.pk).status, "paid")
        self.assertEqual((LedgerEntry.objects.count(), License.objects.filter(user=self.buyer).count()), (0, 1))


class LedgerInvariantTests(BaobabTestCase):
    def test_unbalanced_batch_cannot_be_committed_and_ledger_is_append_only(self):
        shop = make_shop()
        buyer = make_user()
        order, _ = paid_order(shop, buyer)
        with self.assertRaises(Exception) as cm, transaction.atomic():
            LedgerEntry.objects.create(order=order, account="platform", kind="charge", amount_minor=1, currency="XAF")  # un centime cree de rien
            connection.cursor().execute("SET CONSTRAINTS ALL IMMEDIATE")
        self.assertIn("desequilibre", str(cm.exception))
        entry = LedgerEntry.objects.filter(order=order).first()
        for sql in ("UPDATE payments_ledger_entry SET amount_minor = 0 WHERE id = %s", "DELETE FROM payments_ledger_entry WHERE id = %s"):
            with self.assertRaises(Exception) as cm, transaction.atomic(), connection.cursor() as cur:
                cur.execute(sql, [entry.pk])
            self.assertIn("ecriture seule", str(cm.exception))
        with self.assertRaises(IntegrityError), transaction.atomic():
            LedgerEntry.objects.create(order=order, account="seller", kind="charge", amount_minor=5, currency="XAF")  # vendeur sans boutique

    def test_mixed_currency_batch_is_rejected(self):
        shop = make_shop(); buyer = make_user()
        order, _ = paid_order(shop, buyer)
        import uuid
        b = uuid.uuid4()
        with self.assertRaises(Exception), transaction.atomic():
            LedgerEntry.objects.create(batch=b, order=order, account="buyer", kind="refund", amount_minor=10, currency="XAF")
            LedgerEntry.objects.create(batch=b, order=order, account="platform", kind="refund", amount_minor=-10, currency="EUR")
            connection.cursor().execute("SET CONSTRAINTS ALL IMMEDIATE")


class WebhookTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.shop, self.buyer = make_shop(price=5_000), make_user()
        M.add_to_cart(self.buyer, self.shop.variant.pk)
        self.order = M.checkout(self.buyer, idempotency_key="w")
        self.pay = P.start_payment(self.buyer, self.order.pk, "manual")

    def body(self, event_id="evt-1", status="succeeded", amount=5_000):
        return json.dumps({"event_id": event_id, "provider_ref": self.pay.provider_ref, "status": status, "amount_minor": amount, "currency": "XAF"}).encode()

    def sig(self, body, secret=SECRET):
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    @override_settings(PAYMENT_WEBHOOK_SECRETS={"manual": SECRET, "card": "", "mobile_money": ""})
    def test_signed_webhook_settles_once_and_duplicates_are_ignored(self):
        b = self.body()
        self.assertEqual(P.ingest_webhook("manual", b, self.sig(b)), {"duplicate": False})
        self.assertEqual(P.ingest_webhook("manual", b, self.sig(b)), {"duplicate": True})  # le fournisseur renvoie le meme evenement
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, WebhookEvent.objects.count(), LedgerEntry.objects.count()), ("paid", 1, 3))

    @override_settings(PAYMENT_WEBHOOK_SECRETS={"manual": SECRET, "card": "", "mobile_money": ""})
    def test_bad_signature_missing_secret_and_malformed_payloads_are_refused(self):
        b = self.body()
        with self.assertRaises(PermissionDeniedError):
            P.ingest_webhook("manual", b, self.sig(b, "autre-secret"))
        with self.assertRaises(PermissionDeniedError):
            P.ingest_webhook("manual", b, "")
        with self.assertRaises(PermissionDeniedError):
            P.ingest_webhook("card", b, self.sig(b, ""))  # secret non configure : AUCUN webhook non signe n'est accepte
        bad = b"not json"
        with self.assertRaises(DomainError):
            P.ingest_webhook("manual", bad, self.sig(bad))
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, WebhookEvent.objects.count()), ("pending", 0))
        from apps.audit.models import SecurityEvent
        self.assertTrue(SecurityEvent.objects.filter(event_type="webhook_bad_signature").exists())

    @override_settings(PAYMENT_WEBHOOK_SECRETS={"manual": SECRET, "card": "", "mobile_money": ""})
    def test_tampered_amount_in_a_correctly_signed_event_still_fails(self):
        b = self.body(amount=1)
        P.ingest_webhook("manual", b, self.sig(b))
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "pending")


class RefundTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.shop, self.buyer, self.admin = make_shop(price=10_000), make_user(), staff()
        self.order, self.pay = paid_order(self.shop, self.buyer, qty=1)
        self.item = self.order.items.get()

    def test_partial_then_full_refund_reverses_the_ledger_proportionally(self):
        r1 = P.request_refund(self.buyer, self.item.pk, amount_minor=4_000, reason="insatisfait")
        with self.assertRaises(ConflictError):
            P.request_refund(self.buyer, self.item.pk, amount_minor=1_000, reason="encore")  # une demande ouverte par article
        with self.assertRaises(PermissionDeniedError):
            P.process_refund(r1.pk, by=self.buyer, approve=True)
        P.process_refund(r1.pk, by=self.admin, approve=True)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "partially_refunded")
        refund_entries = {e.account: e.amount_minor for e in LedgerEntry.objects.filter(order=self.order, kind="refund")}
        self.assertEqual(refund_entries, {"buyer": 4_000, "seller": -3_600, "platform": -400})  # 10 % de commission rendus
        self.assertTrue(License.objects.get(user=self.buyer).status == "active")  # partiel : la licence reste
        r2 = P.request_refund(self.buyer, self.item.pk, reason="finalement tout")  # montant par defaut = solde restant
        self.assertEqual(r2.amount_minor, 6_000)
        P.process_refund(r2.pk, by=self.admin, approve=True)
        self.order.refresh_from_db(); self.pay.refresh_from_db()
        self.assertEqual((self.order.status, self.pay.status, License.objects.get(user=self.buyer).status), ("refunded", "refunded", "revoked"))
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_order_ledger_balance(%s)", [self.order.pk])
            self.assertEqual(cur.fetchone()[0], 0)  # charge + remboursements = 0
            cur.execute("SELECT seller_gross, seller_refunds, seller_net FROM baobab_store_revenue(%s)", [self.shop.store.pk])
            self.assertEqual(cur.fetchone(), (9_000, 9_000, 0))
        with self.assertRaises(DomainError):
            P.request_refund(self.buyer, self.item.pk, reason="trop")  # commande integralement remboursee

    def test_cannot_refund_more_than_paid_or_after_the_window_and_reject_works(self):
        with self.assertRaises(DomainError):
            P.request_refund(self.buyer, self.item.pk, amount_minor=10_001, reason="x")
        with self.assertRaises(PermissionDeniedError):
            P.request_refund(make_user(), self.item.pk, reason="x")
        r = P.request_refund(self.buyer, self.item.pk, reason="x")
        self.assertEqual(P.process_refund(r.pk, by=self.admin, approve=False).status, "rejected")
        with self.assertRaises(ConflictError):
            P.process_refund(r.pk, by=self.admin, approve=True)
        type(self.order).objects.filter(pk=self.order.pk).update(paid_at=timezone.now() - timedelta(days=30))
        with self.assertRaises(DomainError) as cm:
            P.request_refund(self.buyer, self.item.pk, reason="trop tard")
        self.assertEqual(cm.exception.code, "refund_window_closed")
        self.assertTrue(P.request_refund(self.admin, self.item.pk, reason="geste commercial"))  # l'admin n'est pas soumis au delai

    def test_database_rejects_refunds_above_paid_amount(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            type(self.item).objects.filter(pk=self.item.pk).update(refunded_minor=10_001)


class CoursePurchaseEndToEndTests(BaobabTestCase):
    """Le scenario qui justifie tout le projet : acheter un chapitre payant debloque l'acces ; le rembourser le retire."""

    def test_buying_a_paid_chapter_unlocks_it_and_refund_locks_it_again(self):
        k = make_course()
        student = make_user()
        E.enroll(student, k.course)
        chapter = Chapter.objects.select_related("module__course__classroom").get(pk=k.c3.pk)
        self.assertEqual(access_decision(student, chapter).reason, "payment_required")
        store = M.create_store(k.teacher, name="Ecole", slug="ecole")
        product = M.create_product(store, k.teacher, kind="course", slug="orm", title="ORM avance")
        v = M.add_variant(product, k.teacher, sku="ORM-1", name="Acces", price_minor=5_000, currency="XAF")
        with self.assertRaises(PermissionDeniedError):  # un inconnu ne peut pas vendre le chapitre d'un autre
            M.add_entitlement_target(product, make_user(), scope="chapter", target_id=k.c3.pk)
        stranger_store = M.create_store(make_user(), name="X", slug="x")
        sp = M.create_product(stranger_store, stranger_store.owner, kind="course", slug="vol", title="Vol")
        with self.assertRaises(PermissionDeniedError) as cm:
            M.add_entitlement_target(sp, stranger_store.owner, scope="chapter", target_id=k.c3.pk)
        self.assertEqual(cm.exception.code, "invalid_target")
        M.add_entitlement_target(product, k.teacher, scope="chapter", target_id=k.c3.pk)
        M.publish_product(product, k.teacher)
        M.add_to_cart(student, v.pk)
        order = M.checkout(student, idempotency_key="buy")
        pay = P.start_payment(student, order.pk, "manual")
        P.record_payment_result("manual", pay.provider_ref, "succeeded", amount_minor=5_000, currency="XAF")
        outbox.relay_batch(100)  # OrderPaid -> education.handlers -> droit accorde
        self.assertTrue(access_decision(student, chapter))
        self.assertEqual(access_decision(student, Chapter.objects.select_related("module__course__classroom").get(pk=k.c4.pk)).reason, "payment_required")  # seulement CE chapitre
        outbox.relay_batch(100)
        self.assertEqual(Notification.objects.filter(recipient=student, type_id="order_paid").count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=k.teacher, type_id="new_sale").count(), 1)
        item = order.items.get()
        refund = P.request_refund(student, item.pk, reason="erreur")
        P.process_refund(refund.pk, by=staff(), approve=True)
        outbox.relay_batch(100)
        self.assertEqual(access_decision(student, chapter).reason, "payment_required")  # acces retire
        self.assertFalse(License.objects.filter(user=student).exists())  # un cours n'a pas de licence : pas d'erreur au remboursement


class DownloadAndReviewTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.shop, self.buyer = make_shop(price=3_000), make_user()
        self.order, _ = paid_order(self.shop, self.buyer)
        self.asset = self.shop.product.releases.get().assets.get()

    def test_download_requires_an_active_license_logs_and_is_rate_limited(self):
        with self.assertRaises(PermissionDeniedError):
            M.authorize_download(make_user(), self.asset.pk)
        self.assertEqual(M.authorize_download(self.buyer, self.asset.pk, ip="1.2.3.4"), "files/app.zip")
        self.assertEqual(Download.objects.count(), 1)
        with self.assertRaises(RateLimitedError):
            for _ in range(25):
                M.authorize_download(self.buyer, self.asset.pk)
        lic = License.objects.get(user=self.buyer)
        lic.status = "revoked"; lic.save()
        with self.assertRaises(PermissionDeniedError):
            M.authorize_download(self.buyer, self.asset.pk)

    def test_reviews_only_by_buyers_one_each_and_rating_is_aggregated_by_trigger(self):
        with self.assertRaises(PermissionDeniedError):
            M.create_review(make_user(), self.shop.product.pk, rating=5)
        M.create_review(self.buyer, self.shop.product.pk, rating=4, title="Bien")
        with self.assertRaises(ConflictError):
            M.create_review(self.buyer, self.shop.product.pk, rating=5)
        with self.assertRaises(DomainError):
            M.create_review(self.buyer, self.shop.product.pk, rating=9)
        b2 = make_user()
        paid_order(self.shop, b2, key="b2")
        M.create_review(b2, self.shop.product.pk, rating=2)
        self.shop.product.refresh_from_db()
        self.assertEqual((self.shop.product.rating_count, self.shop.product.rating_avg), (2, 3.0))
        self.shop.product.reviews.filter(user=b2).update(rating=5)  # modification de note
        self.shop.product.refresh_from_db()
        self.assertEqual(self.shop.product.rating_avg, 4.5)
        self.shop.product.reviews.filter(user=b2).delete()
        self.shop.product.refresh_from_db()
        self.assertEqual((self.shop.product.rating_count, self.shop.product.rating_avg), (1, 4.0))

    def test_wishlist_toggle_and_expired_orders(self):
        self.assertEqual((M.toggle_wishlist(self.buyer, self.shop.product.pk), M.toggle_wishlist(self.buyer, self.shop.product.pk)), (True, False))
        shop = make_shop(stock=2, price=100)
        b = make_user()
        M.add_to_cart(b, shop.variant.pk, 2)
        o = M.checkout(b, idempotency_key="exp")
        type(o).objects.filter(pk=o.pk).update(created_at=timezone.now() - timedelta(hours=48))
        self.assertEqual(M.expire_pending_orders(), 1)
        shop.variant.refresh_from_db(); o.refresh_from_db()
        self.assertEqual((o.status, shop.variant.stock), ("cancelled", 2))  # le stock est rendu


class ConcurrentPaymentTests(BaobabTransactionTestCase):
    def test_parallel_success_events_settle_exactly_once(self):
        shop, buyer = make_shop(price=5_000), make_user()
        M.add_to_cart(buyer, shop.variant.pk)
        order = M.checkout(buyer, idempotency_key="p")
        pay = P.start_payment(buyer, order.pk, "manual")
        errors = []

        def worker():
            try:
                P.record_payment_result("manual", pay.provider_ref, "succeeded", amount_minor=5_000, currency="XAF")
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker) for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(errors, [])
        self.assertEqual((LedgerEntry.objects.filter(order=order).count(), License.objects.count(), OutboxEvent.objects.filter(event_type="OrderPaid").count()), (3, 1, 1))

    def test_parallel_refund_approvals_cannot_exceed_the_paid_amount(self):
        shop, buyer, admin = make_shop(price=10_000), make_user(), staff()
        order, pay = paid_order(shop, buyer)
        item = order.items.get()
        r = P.request_refund(buyer, item.pk, reason="x")
        outcomes = []

        def worker():
            try:
                P.process_refund(r.pk, by=admin, approve=True)
                outcomes.append("ok")
            except ConflictError:
                outcomes.append("already")
            except Exception as exc:  # noqa: BLE001
                outcomes.append(repr(exc))
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker) for _ in range(6)]
        [t.start() for t in ts]; [t.join() for t in ts]
        item.refresh_from_db()
        self.assertEqual((outcomes.count("ok"), outcomes.count("already"), item.refunded_minor), (1, 5, 10_000))
