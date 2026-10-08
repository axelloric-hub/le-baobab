import threading
from decimal import Decimal

from django.db import IntegrityError, connections, transaction

from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.marketplace import services as M
from apps.marketplace.models import Coupon, CouponRedemption, OrderItem, ProductVariant
from apps.marketplace.money import allocate, percent_of, platform_fee
from apps.marketplace.testing import make_shop, second_product


class MoneyTests(BaobabTestCase):
    def test_allocate_never_loses_a_cent(self):
        for total, weights in [(100, [1, 1, 1]), (7, [3, 3, 3]), (1000, [999, 1]), (0, [5, 5]), (5, [0, 0])]:
            shares = allocate(total, weights)
            self.assertEqual(sum(shares), total if sum(weights) else 0, (total, weights))
            self.assertTrue(all(s >= 0 for s in shares))
        self.assertEqual(allocate(100, [1, 1, 1]), [34, 33, 33])  # reste distribue, resultat deterministe

    def test_fee_rounds_down_in_favour_of_the_seller(self):
        self.assertEqual((platform_fee(10_000, 1000), platform_fee(99, 1000), platform_fee(5, 1000)), (1000, 9, 0))
        self.assertEqual(percent_of(999, 10), 99)
        with self.assertRaises(ValueError):
            allocate(-1, [1])


class CatalogTests(BaobabTestCase):
    def test_publishing_rules(self):
        seller = make_user()
        store = M.create_store(seller, name="S", slug="s1")
        p = M.create_product(store, seller, kind="application", slug="a", title="A")
        with self.assertRaises(DomainError) as cm:
            M.publish_product(p, seller)
        self.assertEqual(cm.exception.code, "no_variant")
        M.add_variant(p, seller, sku="A-1", name="x", price_minor=100, currency="xaf")
        with self.assertRaises(DomainError) as cm:
            M.publish_product(p, seller)
        self.assertEqual(cm.exception.code, "no_release")
        with self.assertRaises(DomainError):
            M.add_release(p, seller, version="1", assets=[{"filename": "f", "storage_key": "k", "size_bytes": 1, "checksum_sha256": "not-a-hash"}])
        with self.assertRaises(DomainError):
            M.add_release(p, seller, version="1", assets=[])
        with self.assertRaises(PermissionDeniedError):
            M.publish_product(p, make_user())
        course = M.create_product(store, seller, kind="course", slug="c", title="Formation")
        M.add_variant(course, seller, sku="C-1", name="x", price_minor=500, currency="XAF")
        with self.assertRaises(DomainError) as cm:
            M.publish_product(course, seller)
        self.assertEqual(cm.exception.code, "no_target")

    def test_variant_constraints_and_defaults(self):
        shop = make_shop()
        with self.assertRaises(DomainError):
            M.add_variant(shop.product, shop.seller, sku=shop.variant.sku, name="dup", price_minor=1, currency="XAF")  # SKU unique
        with self.assertRaises(DomainError):
            M.add_variant(shop.product, shop.seller, sku="NEG", name="n", price_minor=1, currency="XAF", stock=-1)
        v2 = M.add_variant(shop.product, shop.seller, sku="V2", name="Pro", price_minor=20000, currency="XAF")
        self.assertEqual((shop.variant.is_default, v2.is_default), (True, False))
        with self.assertRaises(IntegrityError), transaction.atomic():
            ProductVariant.objects.filter(pk=v2.pk).update(is_default=True)  # un seul defaut par produit

    def test_release_latest_is_unique_per_platform_and_stale_ones_are_demoted(self):
        shop = make_shop()
        asset = [{"filename": "a", "storage_key": "k2", "size_bytes": 1, "checksum_sha256": "a" * 64}]
        M.add_release(shop.product, shop.seller, version="1.1.0", platform="windows", assets=asset)
        latest = shop.product.releases.filter(platform="windows", is_latest=True)
        self.assertEqual((latest.count(), latest.get().version), (1, "1.1.0"))
        with self.assertRaises(DomainError):
            M.add_release(shop.product, shop.seller, version="1.1.0", platform="windows", assets=asset)  # version deja publiee


class CartAndCheckoutTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.shop = make_shop(stock=5, price=10_000)
        self.buyer = make_user()

    def test_cart_rules(self):
        M.add_to_cart(self.buyer, self.shop.variant.pk, 2)
        item = M.add_to_cart(self.buyer, self.shop.variant.pk, 1)
        self.assertEqual(item.quantity, 3)
        with self.assertRaises(DomainError) as cm:
            M.add_to_cart(self.buyer, self.shop.variant.pk, 3)  # 6 > stock 5
        self.assertEqual(cm.exception.code, "out_of_stock")
        M.set_cart_quantity(self.buyer, self.shop.variant.pk, 0)
        self.assertEqual(self.buyer.cart.items.count(), 0)

    def test_unpublished_or_suspended_products_cannot_be_bought(self):
        self.shop.product.status = "suspended"
        self.shop.product.save()
        with self.assertRaises(DomainError):
            M.add_to_cart(self.buyer, self.shop.variant.pk)

    def test_checkout_freezes_prices_decrements_stock_and_is_idempotent(self):
        M.add_to_cart(self.buyer, self.shop.variant.pk, 2)
        o1 = M.checkout(self.buyer, idempotency_key="k1")
        o2 = M.checkout(self.buyer, idempotency_key="k1")  # double clic / retry reseau
        self.assertEqual((o1.pk, o1.total_minor, o1.status), (o2.pk, 20_000, "pending"))
        self.shop.variant.refresh_from_db()
        self.assertEqual(self.shop.variant.stock, 3)  # decremente UNE fois
        item = o1.items.get()
        self.assertEqual((item.unit_price_minor, item.platform_fee_minor, item.seller_net_minor), (10_000, 2_000, 18_000))
        ProductVariant.objects.filter(pk=self.shop.variant.pk).update(price_minor=99_999)  # le prix change APRES
        item.refresh_from_db()
        self.assertEqual((item.unit_price_minor, item.line_total_minor), (10_000, 20_000))  # l'historique ne bouge pas
        self.assertEqual(self.buyer.cart.items.count(), 0)
        with self.assertRaises(DomainError):
            M.checkout(self.buyer, idempotency_key="k2")  # panier vide
        with self.assertRaises(DomainError):
            M.checkout(self.buyer, idempotency_key=" ")

    def test_database_rejects_inconsistent_money(self):
        M.add_to_cart(self.buyer, self.shop.variant.pk, 1)
        o = M.checkout(self.buyer, idempotency_key="k")
        for update in ({"total_minor": 1}, {"discount_minor": 999_999, "total_minor": 0}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                type(o).objects.filter(pk=o.pk).update(**update)
        item = o.items.get()
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrderItem.objects.filter(pk=item.pk).update(platform_fee_minor=1)  # frais + net != montant paye
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrderItem.objects.filter(pk=item.pk).update(refunded_minor=10**9)  # plus rembourse que paye

    def test_mixed_currencies_are_rejected(self):
        other = M.create_product(self.shop.store, self.shop.seller, kind="template", slug="eur", title="EUR")
        v = M.add_variant(other, self.shop.seller, sku="EUR-1", name="x", price_minor=500, currency="EUR")
        M.publish_product(other, self.shop.seller)
        M.add_to_cart(self.buyer, self.shop.variant.pk)
        with self.assertRaises(DomainError) as cm:
            M.add_to_cart(self.buyer, v.pk)
        self.assertEqual(cm.exception.code, "mixed_currency")

    def test_cancel_restores_stock_and_coupon(self):
        c = M.create_coupon(self.shop.seller, code="promo10", kind="percent", value=10, store=self.shop.store, max_redemptions=1)
        M.add_to_cart(self.buyer, self.shop.variant.pk, 2)
        o = M.checkout(self.buyer, idempotency_key="k", coupon_code="PROMO10")
        c.refresh_from_db(); self.shop.variant.refresh_from_db()
        self.assertEqual((o.discount_minor, o.total_minor, c.used_count, self.shop.variant.stock), (2_000, 18_000, 1, 3))
        with self.assertRaises(PermissionDeniedError):
            M.cancel_order(o.pk, by=make_user())
        M.cancel_order(o.pk, by=self.buyer)
        c.refresh_from_db(); self.shop.variant.refresh_from_db()
        self.assertEqual((c.used_count, self.shop.variant.stock, CouponRedemption.objects.count()), (0, 5, 0))
        with self.assertRaises(ConflictError):
            M.cancel_order(o.pk, by=self.buyer)


class CouponTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.shop = make_shop(price=10_000)
        self.p2, self.v2 = second_product(self.shop, price=5_000, sku="T-1")
        self.other = make_shop(price=7_000)
        self.buyer = make_user()

    def order(self, code, *variants, key="k"):
        for v in variants:
            M.add_to_cart(self.buyer, v.pk)
        return M.checkout(self.buyer, idempotency_key=key, coupon_code=code)

    def test_percent_coupon_is_split_across_lines_to_the_cent(self):
        M.create_coupon(self.shop.seller, code="P33", kind="percent", value=33, store=self.shop.store)
        o = self.order("p33", self.shop.variant, self.v2)  # 15 000 -> remise 4 950
        self.assertEqual((o.subtotal_minor, o.discount_minor, o.total_minor), (15_000, 4_950, 10_050))
        self.assertEqual(sum(i.discount_minor for i in o.items.all()), 4_950)
        self.assertEqual(sum(i.platform_fee_minor + i.seller_net_minor for i in o.items.all()), 10_050)

    def test_store_coupon_only_discounts_that_stores_lines(self):
        M.create_coupon(self.shop.seller, code="MINE", kind="fixed", value=2_000, currency="XAF", store=self.shop.store)
        o = self.order("MINE", self.shop.variant, self.other.variant)
        self.assertEqual({i.store_id: i.discount_minor for i in o.items.all()}, {self.shop.store.pk: 2_000, self.other.store.pk: 0})

    def test_coupon_validation_rules(self):
        c = M.create_coupon(self.shop.seller, code="ONCE", kind="fixed", value=500, currency="XAF", store=self.shop.store, per_user_limit=1, min_subtotal_minor=8_000)
        with self.assertRaises(DomainError) as cm:
            self.order("NOPE", self.shop.variant, key="a")
        self.assertEqual(cm.exception.code, "coupon_invalid")
        M.set_cart_quantity(self.buyer, self.shop.variant.pk, 0)
        with self.assertRaises(DomainError) as cm:
            self.order("ONCE", self.v2, key="b")  # 5 000 < minimum 8 000
        self.assertEqual(cm.exception.code, "coupon_min_subtotal")
        M.set_cart_quantity(self.buyer, self.v2.pk, 0)
        self.order("ONCE", self.shop.variant, key="c")
        with self.assertRaises(DomainError) as cm:
            self.order("ONCE", self.shop.variant, key="d")
        self.assertEqual(cm.exception.code, "coupon_already_used")
        c.is_active = False; c.save()
        with self.assertRaises(DomainError):
            self.order("ONCE", self.shop.variant, key="e")

    def test_database_caps_coupon_usage(self):
        c = M.create_coupon(make_staff(), code="CAP", kind="percent", value=5, max_redemptions=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Coupon.objects.filter(pk=c.pk).update(used_count=2)

    def test_platform_coupon_requires_admin_and_codes_are_case_insensitive_unique(self):
        with self.assertRaises(PermissionDeniedError):
            M.create_coupon(self.buyer, code="X", kind="percent", value=5)
        M.create_coupon(make_staff(), code="Same", kind="percent", value=5)
        with self.assertRaises(DomainError):
            M.create_coupon(make_staff(), code="SAME", kind="percent", value=7)


def make_staff():
    u = make_user()
    u.is_staff = True
    u.save()
    return u


class CheckoutConcurrencyTests(BaobabTransactionTestCase):
    def test_parallel_checkouts_never_oversell(self):
        shop = make_shop(stock=3, price=1_000)
        buyers = [make_user() for _ in range(8)]
        for b in buyers:
            M.add_to_cart(b, shop.variant.pk, 1)
        outcomes, lock = [], threading.Lock()

        def worker(buyer):
            try:
                M.checkout(buyer, idempotency_key="race")
                result = "ok"
            except DomainError as exc:
                result = exc.code
            except Exception as exc:  # noqa: BLE001
                result = repr(exc)
            finally:
                connections.close_all()
            with lock:
                outcomes.append(result)

        ts = [threading.Thread(target=worker, args=(b,)) for b in buyers]
        [t.start() for t in ts]; [t.join() for t in ts]
        shop.variant.refresh_from_db()
        self.assertEqual((outcomes.count("ok"), outcomes.count("out_of_stock"), len(outcomes), shop.variant.stock), (3, 5, 8, 0))  # exactement 3 ventes, jamais de stock negatif

    def test_same_buyer_same_key_in_parallel_creates_one_order(self):
        shop = make_shop(stock=10, price=1_000)
        buyer = make_user()
        M.add_to_cart(buyer, shop.variant.pk, 2)
        errors = []

        def worker():
            try:
                M.checkout(buyer, idempotency_key="same")
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker) for _ in range(6)]
        [t.start() for t in ts]; [t.join() for t in ts]
        shop.variant.refresh_from_db()
        self.assertEqual(errors, [])
        self.assertEqual((buyer.orders.count(), shop.variant.stock), (1, 8))
