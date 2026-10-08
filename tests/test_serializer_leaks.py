import json

from apps.advertising.serializers import AdDeliverySerializer
from apps.advertising.testing import make_live_ad
from apps.core.testing import BaobabTestCase, make_user
from apps.jobs.serializers import ApplicationSerializer, JobPublicSerializer
from apps.jobs.testing import make_company_job
from apps.jobs import services as J
from apps.marketplace import services as M
from apps.marketplace.serializers import OrderSerializer, ProductPublicSerializer
from apps.marketplace.testing import make_shop


class NoLeakTests(BaobabTestCase):
    """Les secrets commerciaux (commission, net vendeur, stock exact, encheres, budgets) ne sortent JAMAIS par une reponse destinee au client."""

    def test_buyer_never_sees_platform_fee_seller_net_or_exact_stock(self):
        shop, buyer = make_shop(stock=7, price=10_000), make_user()
        M.add_to_cart(buyer, shop.variant.pk)
        order = M.checkout(buyer, idempotency_key="k")
        blob = json.dumps(OrderSerializer(order).data, default=str)
        for secret in ("platform_fee", "seller_net", "store", "coupon_id"):
            self.assertNotIn(secret, blob, secret)
        product = json.dumps(ProductPublicSerializer(shop.product).data, default=str)
        self.assertIn("in_stock", product)
        self.assertNotIn('"stock"', product)

    def test_ad_delivery_payload_hides_bid_budget_and_targeting(self):
        live = make_live_ad(bid=9, rules=[{"field": "skill", "values": ["django"]}])
        blob = json.dumps(AdDeliverySerializer(live.ad).data, default=str)
        for secret in ("bid", "budget", "rules", "targeting", "account", "balance", "values"):
            self.assertNotIn(secret, blob, secret)
        self.assertIn("destination_url", blob)

    def test_public_job_and_candidate_views_hide_internal_fields(self):
        k = make_company_job()
        self.assertNotIn("posted_by", json.dumps(JobPublicSerializer(k.job).data, default=str))
        cand = make_user()
        app = J.apply(k.job.pk, cand, cover_letter="Bonjour")
        blob = json.dumps(ApplicationSerializer(app).data, default=str)
        for internal in ("applicant", "history", "expected_salary"):
            self.assertNotIn(internal, blob)
