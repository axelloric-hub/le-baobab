import hashlib
import hmac
import json
from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

from apps.core import outbox
from apps.core.api_testing import api_client, upload_file, verified_user
from apps.core.testing import BaobabTestCase
from apps.storage.backends import FakeBackend


def staff(name="admin"):
    u = verified_user(name)
    u.is_staff = True
    u.save()
    return u


class Base(BaobabTestCase):
    def setUp(self):
        super().setUp()
        FakeBackend.reset()
        self.seller, self.buyer, self.other = verified_user("vendeur"), verified_user("acheteur"), verified_user("autre")
        self.cs, self.cb, self.co, self.anon = api_client(self.seller), api_client(self.buyer), api_client(self.other), api_client()
        self.admin = staff()
        self.ca = api_client(self.admin)


@override_settings(PAYMENTS_SIMULATION_ENABLED=True)
class PurchaseApiTests(Base):
    def make_course_product(self):
        self.cs.post("/api/v1/classrooms/", {"title": "Ecole", "slug": "ecole"}, format="json")
        course = self.cs.post("/api/v1/classrooms/ecole/courses/", {"title": "Django", "slug": "django"}, format="json").json()["id"]
        mod = self.cs.post(f"/api/v1/courses/{course}/modules/", {"title": "Avance", "is_free": False, "price_minor": 9000, "currency": "XAF"}, format="json").json()["id"]
        self.chapter = self.cs.post(f"/api/v1/modules/{mod}/chapters/", {"title": "ORM", "is_free": False, "price_minor": 5000, "currency": "XAF"}, format="json").json()["id"]
        self.cs.post(f"/api/v1/chapters/{self.chapter}/blocks/", {"kind": "text", "body": "Contenu payant"}, format="json")
        self.assertEqual(self.cs.post(f"/api/v1/courses/{course}/publish/").status_code, 200)
        self.cs.post("/api/v1/stores/", {"name": "Boutique", "slug": "boutique"}, format="json")
        pid = self.cs.post("/api/v1/stores/boutique/products/", {"kind": "course", "slug": "orm", "title": "ORM avance"}, format="json").json()["id"]
        self.variant = self.cs.post(f"/api/v1/products/{pid}/variants/", {"sku": "ORM-1", "name": "Acces", "price_minor": 5000, "currency": "XAF"}, format="json").json()["id"]
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/publish/").json()["error"]["code"], "no_target")  # une formation doit debloquer quelque chose
        self.assertEqual(self.co.post(f"/api/v1/products/{pid}/entitlement-targets/", {"scope": "chapter", "target_id": self.chapter}, format="json").status_code, 404)  # produit d'un autre vendeur
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/entitlement-targets/", {"scope": "chapter", "target_id": self.chapter}, format="json").status_code, 201)
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/publish/").status_code, 200)
        self.course, self.pid = course, pid

    def buy(self, key="k1"):
        self.assertEqual(self.cb.post("/api/v1/cart/items/", {"variant": self.variant}, format="json").status_code, 201)
        order = self.cb.post("/api/v1/checkout/", {"idempotency_key": key}, format="json")
        self.assertEqual(order.status_code, 201, order.content)
        return order.json()

    def test_buying_a_chapter_unlocks_it_and_refunding_locks_it_again(self):
        self.make_course_product()
        self.cb.post(f"/api/v1/courses/{self.course}/enroll/")
        self.assertEqual(self.cb.get(f"/api/v1/chapters/{self.chapter}/content/").status_code, 402)
        order = self.buy()
        self.assertEqual((order["status"], order["total_minor"]), ("pending", 5000))
        self.assertNotIn("platform_fee", json.dumps(order))  # la commission ne fuit pas vers l'acheteur
        again = self.cb.post("/api/v1/checkout/", {"idempotency_key": "k1"}, format="json")
        self.assertEqual(again.json()["id"], order["id"])  # idempotent
        self.assertEqual(self.co.get(f"/api/v1/orders/{order['id']}/").status_code, 404)  # la commande d'un autre n'existe pas
        self.assertEqual(self.co.post(f"/api/v1/orders/{order['id']}/cancel/").status_code, 404)
        pay = self.cb.post("/api/v1/payments/start/", {"order": order["id"], "provider": "manual"}, format="json").json()
        self.assertEqual(self.co.post(f"/api/v1/payments/{pay['id']}/simulate/", {}, format="json").status_code, 404)  # le paiement d'un autre
        done = self.cb.post(f"/api/v1/payments/{pay['id']}/simulate/", {"outcome": "succeeded"}, format="json").json()
        self.assertEqual(done["order"]["status"], "paid")
        outbox.relay_batch(100)  # OrderPaid -> droit d'acces accorde automatiquement
        self.assertEqual(self.cb.get(f"/api/v1/chapters/{self.chapter}/content/").json()["blocks"][0]["body"], "Contenu payant")
        self.assertEqual(self.co.get(f"/api/v1/chapters/{self.chapter}/content/").status_code, 403)
        led = self.ca.get(f"/api/v1/admin/ledger/orders/{order['id']}/").json()
        self.assertEqual((led["balance"], len(led["entries"])), (0, 3))
        self.assertEqual(self.cb.get(f"/api/v1/admin/ledger/orders/{order['id']}/").status_code, 403)
        self.assertEqual(self.cs.get("/api/v1/stores/boutique/revenue/").json()["net_minor"], 4500)
        self.assertEqual(self.co.get("/api/v1/stores/boutique/revenue/").status_code, 404)
        item = done["order"]["items"][0]["id"]
        self.assertEqual(self.co.post("/api/v1/refunds/", {"order_item": item, "reason": "x"}, format="json").status_code, 404)  # on ne rembourse pas l'achat d'un autre
        rid = self.cb.post("/api/v1/refunds/", {"order_item": item, "reason": "erreur d'achat"}, format="json").json()["id"]
        self.assertEqual(self.cb.post(f"/api/v1/admin/refunds/{rid}/decision/", {"approve": True}, format="json").status_code, 403)
        self.assertEqual(self.ca.post(f"/api/v1/admin/refunds/{rid}/decision/", {"approve": True}, format="json").json()["status"], "processed")
        outbox.relay_batch(100)
        self.assertEqual(self.cb.get(f"/api/v1/chapters/{self.chapter}/content/").status_code, 402)  # acces retire
        self.assertEqual(self.cs.get("/api/v1/stores/boutique/revenue/").json()["net_minor"], 0)

    def test_simulation_endpoint_is_off_by_default(self):
        self.make_course_product()
        order = self.buy()
        pay = self.cb.post("/api/v1/payments/start/", {"order": order["id"], "provider": "manual"}, format="json").json()
        with override_settings(PAYMENTS_SIMULATION_ENABLED=False):
            self.assertEqual(self.cb.post(f"/api/v1/payments/{pay['id']}/simulate/", {}, format="json").status_code, 404)

    def test_webhook_signature_and_idempotence(self):
        self.make_course_product()
        order = self.buy()
        pay = self.cb.post("/api/v1/payments/start/", {"order": order["id"], "provider": "manual"}, format="json").json()
        body = json.dumps({"event_id": "e1", "provider_ref": pay["provider_ref"], "status": "succeeded", "amount_minor": 5000, "currency": "XAF"}).encode()
        sig = hmac.new(b"secret-webhook", body, hashlib.sha256).hexdigest()
        with override_settings(PAYMENT_WEBHOOK_SECRETS={"manual": "secret-webhook", "card": "", "mobile_money": ""}):
            bad = self.anon.post("/api/v1/payments/webhooks/manual/", data=body, content_type="application/json", HTTP_X_SIGNATURE="0" * 64)
            self.assertEqual(bad.status_code, 403)
            ok = self.anon.post("/api/v1/payments/webhooks/manual/", data=body, content_type="application/json", HTTP_X_SIGNATURE=sig)
            self.assertEqual((ok.status_code, ok.json()), (200, {"duplicate": False}))
            self.assertEqual(self.anon.post("/api/v1/payments/webhooks/manual/", data=body, content_type="application/json", HTTP_X_SIGNATURE=sig).json(), {"duplicate": True})
        self.assertEqual(self.cb.get(f"/api/v1/orders/{order['id']}/").json()["status"], "paid")

    def test_cart_stock_and_coupons(self):
        self.make_course_product()
        self.assertEqual(self.cb.post("/api/v1/cart/items/", {"variant": "00000000-0000-4000-8000-000000000000"}, format="json").status_code, 404)
        self.cb.post("/api/v1/cart/items/", {"variant": self.variant, "quantity": 2}, format="json")
        cart = self.cb.get("/api/v1/cart/").json()
        self.assertEqual((cart["subtotal_minor"], cart["items"][0]["quantity"]), (10000, 2))
        self.assertEqual(self.cb.patch(f"/api/v1/cart/items/{self.variant}/", {"quantity": 1}, format="json").json()["subtotal_minor"], 5000)
        self.cs.post("/api/v1/stores/boutique/coupons/", {"code": "BIENVENUE", "kind": "percent", "value": 20}, format="json")
        o = self.cb.post("/api/v1/checkout/", {"idempotency_key": "c1", "coupon_code": "bienvenue"}, format="json").json()
        self.assertEqual((o["discount_minor"], o["total_minor"]), (1000, 4000))
        self.assertEqual(self.co.post("/api/v1/stores/boutique/coupons/", {"code": "PIRATE", "kind": "percent", "value": 99}, format="json").status_code, 404)  # pas ma boutique
        self.assertEqual(self.cb.post(f"/api/v1/orders/{o['id']}/cancel/").json()["status"], "cancelled")

    def test_application_product_download_needs_a_license_and_a_valid_release(self):
        self.cs.post("/api/v1/stores/", {"name": "Apps", "slug": "apps"}, format="json")
        pid = self.cs.post("/api/v1/stores/apps/products/", {"kind": "application", "slug": "outil", "title": "Mon outil"}, format="json").json()["id"]
        v = self.cs.post(f"/api/v1/products/{pid}/variants/", {"sku": "OUTIL-1", "name": "Licence", "price_minor": 3000, "currency": "XAF"}, format="json").json()["id"]
        fid = upload_file(self.cs, "product_asset", "application/zip", size=2048, filename="outil.zip")
        sha = hashlib.sha256(b"outil").hexdigest()
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/releases/", {"version": "1.0.0", "platform": "windows", "assets": [{"file": fid, "checksum_sha256": "pas-un-hash"}]}, format="json").status_code, 400)
        theirs = upload_file(self.cb, "product_asset", "application/zip", size=10, filename="x.zip")
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/releases/", {"version": "1.0.0", "assets": [{"file": theirs, "checksum_sha256": sha}]}, format="json").json()["error"]["code"], "invalid_file")
        r = self.cs.post(f"/api/v1/products/{pid}/releases/", {"version": "1.0.0", "platform": "windows", "changelog": "Premiere version", "requirements": "Windows 10", "assets": [{"file": fid, "checksum_sha256": sha}]}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/publish/").status_code, 200)
        detail = self.anon.get(f"/api/v1/products/{pid}/").json()
        self.assertEqual((detail["latest_release"]["version"], detail["latest_release"]["files"][0]["filename"]), ("1.0.0", "outil.zip"))
        self.assertNotIn("storage_key", json.dumps(detail))  # aucun lien de telechargement dans la fiche publique
        asset = detail["latest_release"]["files"][0]["id"]
        self.assertEqual(self.cb.post(f"/api/v1/assets/{asset}/download/").status_code, 403)  # sans licence
        self.cb.post("/api/v1/cart/items/", {"variant": v}, format="json")
        order = self.cb.post("/api/v1/checkout/", {"idempotency_key": "app1"}, format="json").json()
        pay = self.cb.post("/api/v1/payments/start/", {"order": order["id"], "provider": "manual"}, format="json").json()
        self.cb.post(f"/api/v1/payments/{pay['id']}/simulate/", {}, format="json")
        lic = self.cb.get("/api/v1/me/licenses/").json()
        self.assertEqual((len(lic), lic[0]["status"], lic[0]["files"][0]["filename"]), (1, "active", "outil.zip"))
        dl = self.cb.post(f"/api/v1/assets/{asset}/download/").json()
        self.assertIn("fake-bucket.invalid/get/product_asset/", dl["url"])
        self.assertEqual(self.co.post(f"/api/v1/assets/{asset}/download/").status_code, 403)
        self.assertEqual(self.co.get("/api/v1/me/licenses/").json(), [])
        self.assertEqual(self.cb.post(f"/api/v1/products/{pid}/reviews/", {"rating": 5, "title": "Top"}, format="json").status_code, 201)
        self.assertEqual(self.co.post(f"/api/v1/products/{pid}/reviews/", {"rating": 1}, format="json").status_code, 403)  # avis reserves aux acheteurs
        self.assertEqual(self.anon.get(f"/api/v1/products/{pid}/").json()["rating"], 5.0)

    def test_drafts_are_private_and_catalog_is_public(self):
        self.cs.post("/api/v1/stores/", {"name": "B", "slug": "b"}, format="json")
        pid = self.cs.post("/api/v1/stores/b/products/", {"kind": "template", "slug": "t", "title": "Modele"}, format="json").json()["id"]
        self.assertEqual(self.anon.get(f"/api/v1/products/{pid}/").status_code, 404)
        self.assertEqual(self.cs.get(f"/api/v1/products/{pid}/").status_code, 200)
        self.assertEqual(self.anon.get("/api/v1/products/").json()["results"], [])
        self.assertEqual(self.co.post(f"/api/v1/products/{pid}/variants/", {"sku": "X", "name": "x", "price_minor": 1, "currency": "XAF"}, format="json").status_code, 404)


class OpportunitiesApiTests(Base):
    def setUp(self):
        super().setUp()
        self.ct = self.cs
        self.third = api_client(verified_user("tiers"))
        self.cs.post("/api/v1/companies/", {"name": "Afrik Tech", "slug": "afrik-tech", "size_range": "11-50"}, format="json")
        self.cs.post("/api/v1/companies/afrik-tech/members/", {"username": "autre", "role": "recruiter"}, format="json")  # "autre" = recruteur de l'entreprise
        self.job = self.cs.post("/api/v1/jobs/", {"company": "afrik-tech", "title": "Dev Django", "description": "Nous recherchons un developpeur backend Django pour la plateforme LE BAOBAB.", "job_type": "full_time", "contract_type": "permanent",
                                                  "skills": [{"slug": "django"}], "salary": {"min": 300000, "max": 600000, "currency": "XAF", "period": "month"}}, format="json").json()["id"]

    def test_company_roles_verification_and_privacy_of_applications(self):
        self.assertEqual(self.cb.post("/api/v1/companies/afrik-tech/members/", {"username": "acheteur"}, format="json").status_code, 403)
        self.assertEqual(self.anon.get("/api/v1/companies/afrik-tech/").json()["verified"], False)
        self.cs.post("/api/v1/companies/afrik-tech/verification/", {"method": "document"}, format="json")
        q = self.ca.get("/api/v1/admin/company-verifications/").json()["results"]
        self.ca.post(f"/api/v1/admin/company-verifications/{q[0]['id']}/review/", {"approve": True}, format="json")
        self.assertEqual(self.anon.get("/api/v1/companies/afrik-tech/").json()["verified"], True)
        self.assertEqual(self.cs.delete("/api/v1/companies/afrik-tech/members/vendeur/").json()["error"]["code"], "last_owner")
        self.assertEqual(self.anon.get(f"/api/v1/jobs/{self.job}/").status_code, 404)  # brouillon
        self.assertEqual(self.cb.post(f"/api/v1/jobs/{self.job}/publish/").status_code, 404)
        self.assertEqual(self.co.post(f"/api/v1/jobs/{self.job}/publish/").status_code, 200)  # le recruteur de l'entreprise
        self.assertEqual(len(self.anon.get("/api/v1/jobs/", {"skill": "django"}).json()["results"]), 1)
        self.assertEqual(self.anon.get("/api/v1/jobs/", {"skill": "rust"}).json()["results"], [])
        cv = upload_file(self.cb, "cv", "application/pdf", filename="cv.pdf")
        app = self.cb.post(f"/api/v1/jobs/{self.job}/apply/", {"cover_letter": "Motive !", "cv_file": cv}, format="json")
        self.assertEqual(app.status_code, 201, app.content)
        aid = app.json()["id"]
        self.assertEqual(self.cb.post(f"/api/v1/jobs/{self.job}/apply/", {"cover_letter": "encore"}, format="json").status_code, 409)
        self.assertEqual(self.cs.post(f"/api/v1/jobs/{self.job}/apply/", {"cover_letter": "moi"}, format="json").status_code, 403)  # pas sur sa propre offre
        third = self.third
        self.assertEqual(third.get(f"/api/v1/applications/{aid}/").status_code, 404)  # la candidature d'un autre est invisible
        self.assertEqual(third.get(f"/api/v1/jobs/{self.job}/applications/").status_code, 404)
        self.assertEqual(self.cb.get(f"/api/v1/jobs/{self.job}/applications/").status_code, 404)  # meme le candidat ne liste pas les autres
        self.assertEqual(self.cs.get(f"/api/v1/applications/{aid}/").json()["applicant"]["username"], "acheteur")
        self.assertIsNone(self.cb.get(f"/api/v1/applications/{aid}/").json().get("applicant"))
        self.assertEqual(self.cs.get(f"/api/v1/applications/{aid}/").json()["cv_url"][:30], "https://fake-bucket.invalid/ge")
        self.assertEqual(self.cs.post(f"/api/v1/applications/{aid}/transition/", {"to_status": "hired"}, format="json").json()["error"]["code"], "invalid_transition")
        self.assertEqual(self.cb.post(f"/api/v1/applications/{aid}/transition/", {"to_status": "shortlisted"}, format="json").status_code, 403)

    def test_interview_offer_and_contract(self):
        self.co.post(f"/api/v1/jobs/{self.job}/publish/")
        aid = self.cb.post(f"/api/v1/jobs/{self.job}/apply/", {"cover_letter": "Bonjour"}, format="json").json()["id"]
        for st in ("reviewing", "shortlisted"):
            self.assertEqual(self.cs.post(f"/api/v1/applications/{aid}/transition/", {"to_status": st}, format="json").status_code, 200)
        start = timezone.now() + timedelta(days=2)
        slot = self.cs.post(f"/api/v1/jobs/{self.job}/slots/", {"starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=1)).isoformat()}, format="json")
        self.assertEqual(slot.status_code, 201, slot.content)
        overlap = self.cs.post(f"/api/v1/jobs/{self.job}/slots/", {"starts_at": (start + timedelta(minutes=30)).isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat()}, format="json")
        self.assertEqual(overlap.status_code, 409)
        self.assertEqual(len(self.cb.get(f"/api/v1/jobs/{self.job}/slots/").json()), 1)
        self.assertEqual(self.third.get(f"/api/v1/jobs/{self.job}/slots/").status_code, 404)
        self.assertEqual(self.cb.post(f"/api/v1/applications/{aid}/book/", {"slot": slot.json()["id"], "location": "https://meet.example.com/x"}, format="json").status_code, 201)
        self.assertEqual(self.cb.post(f"/api/v1/applications/{aid}/offer/", {"amount_minor": 1, "currency": "XAF"}, format="json").status_code, 404)  # le candidat ne s'offre pas un poste
        off = self.cs.post(f"/api/v1/applications/{aid}/offer/", {"amount_minor": 500000, "currency": "xaf"}, format="json").json()
        self.assertEqual(self.co.post(f"/api/v1/offers/{off['id']}/respond/", {"accept": True}, format="json").status_code, 404)  # l'offre d'un autre
        self.assertEqual(self.cb.post(f"/api/v1/offers/{off['id']}/respond/", {"accept": True}, format="json").json()["status"], "accepted")
        contracts = self.cb.get("/api/v1/me/contracts/").json()["results"]
        self.assertEqual((len(contracts), contracts[0]["kind"], contracts[0]["amount_minor"]), (1, "employment", 500000))
        self.assertEqual(self.cs.get(f"/api/v1/contracts/{contracts[0]['id']}/").status_code, 200)
        self.assertEqual(self.third.get(f"/api/v1/contracts/{contracts[0]['id']}/").status_code, 404)

    def test_freelance_proposals_and_milestones(self):
        fj = self.cs.post("/api/v1/jobs/", {"title": "Site vitrine", "description": "Mission freelance : creation d'un site vitrine pour une cooperative agricole.", "job_type": "freelance", "contract_type": "freelance", "skills": [{"slug": "django"}]}, format="json").json()["id"]
        self.assertEqual(self.cs.post(f"/api/v1/jobs/{fj}/publish/").status_code, 200)
        self.assertEqual(self.cb.put("/api/v1/me/freelancer-profile/", {"headline": "Dev Django", "hourly_rate_minor": 15000, "currency": "XAF"}, format="json").status_code, 200)
        self.assertEqual(self.co.put("/api/v1/me/freelancer-profile/", {"hourly_rate_minor": 15000}, format="json").json()["error"]["code"], "invalid_profile")  # un tarif exige une devise
        p1 = self.cb.post(f"/api/v1/jobs/{fj}/proposals/", {"cover_letter": "Je livre", "bid_minor": 200000, "currency": "XAF", "delivery_days": 20}, format="json").json()["id"]
        self.assertEqual(self.cb.post(f"/api/v1/jobs/{fj}/proposals/", {"cover_letter": "bis", "bid_minor": 1, "currency": "XAF", "delivery_days": 1}, format="json").status_code, 409)
        self.assertEqual(self.cb.get(f"/api/v1/jobs/{fj}/proposals/").status_code, 404)  # un concurrent ne voit pas les propositions
        self.assertEqual(self.cb.post(f"/api/v1/proposals/{p1}/accept/", {}, format="json").status_code, 404)
        c = self.cs.post(f"/api/v1/proposals/{p1}/accept/", {"milestones": [{"title": "Maquette", "amount_minor": 50000}, {"title": "Livraison", "amount_minor": 150000}]}, format="json")
        self.assertEqual(c.status_code, 201, c.content)
        ms = [m["id"] for m in c.json()["milestones"]]
        for action, cli in (("start", self.cb), ("submit", self.cb), ("approve", self.cs)):
            self.assertEqual(cli.post(f"/api/v1/milestones/{ms[0]}/advance/", {"action": action}, format="json").status_code, 200)
        self.assertEqual(self.cs.post(f"/api/v1/milestones/{ms[1]}/advance/", {"action": "start"}, format="json").status_code, 403)  # le client ne livre pas a la place du prestataire
        self.assertEqual(self.third.post(f"/api/v1/milestones/{ms[1]}/advance/", {"action": "start"}, format="json").status_code, 404)


class PortfolioAndAdsApiTests(Base):
    def test_portfolio_visibility_certificates_and_ownership(self):
        r = self.cb.post("/api/v1/me/portfolio/projects/", {"slug": "baobab", "title": "LE BAOBAB", "technologies": ["django"], "links": [{"kind": "repository", "provider": "github", "url": "https://github.com/x/y"}]}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pid = r.json()["id"]
        self.assertEqual(self.cb.post("/api/v1/me/portfolio/projects/", {"slug": "http", "title": "x", "links": [{"url": "http://insecure.example.com"}]}, format="json").status_code, 422)
        self.assertEqual(self.co.post(f"/api/v1/me/portfolio/projects/{pid}/links/", {"url": "https://demo.example.com"}, format="json").status_code, 403)  # pas mon projet
        self.assertEqual(self.co.delete(f"/api/v1/me/portfolio/projects/{pid}/").status_code, 404)  # le projet d'un autre est introuvable
        self.assertEqual(self.anon.get("/api/v1/users/acheteur/portfolio/").json()["projects"][0]["technologies"], ["django"])
        self.cb.patch("/api/v1/me/portfolio/", {"visibility": "private"}, format="json")
        self.assertEqual(self.anon.get("/api/v1/users/acheteur/portfolio/").status_code, 404)
        self.assertEqual(self.co.get("/api/v1/users/acheteur/portfolio/").status_code, 404)
        self.assertEqual(self.cb.get("/api/v1/users/acheteur/portfolio/").status_code, 200)
        self.assertEqual(self.cb.post("/api/v1/me/portfolio/experiences/", {"company_name": "X", "title": "Dev", "started_on": "2024-05-01", "ended_on": "2024-01-01"}, format="json").status_code, 422)
        exp = self.cb.post("/api/v1/me/portfolio/experiences/", {"company_name": "X", "title": "Dev", "started_on": "2024-01-01"}, format="json").json()["id"]
        self.assertEqual(self.co.delete(f"/api/v1/me/portfolio/experiences/{exp}/").status_code, 404)  # l'entree d'un autre est introuvable
        self.assertEqual(self.cb.delete(f"/api/v1/me/portfolio/experiences/{exp}/").status_code, 204)
        self.assertEqual(self.cb.post("/api/v1/me/portfolio/certificates/", {"certificate_id": "00000000-0000-4000-8000-000000000000"}, format="json").status_code, 403)

    def test_advertising_isolation_review_serving_and_settlement(self):
        from apps.advertising import delivery as D

        acct = self.cs.post("/api/v1/ads/accounts/", {"name": "Annonceur", "currency": "XAF"}, format="json").json()["id"]
        self.assertEqual(self.co.get(f"/api/v1/ads/campaigns/").json()["results"], [])
        self.assertEqual(self.co.post("/api/v1/ads/campaigns/", {"account": acct, "name": "vol", "starts_at": timezone.now().isoformat(), "daily_budget_minor": 100, "total_budget_minor": 1000}, format="json").status_code, 404)
        self.assertEqual(self.cs.post(f"/api/v1/admin/ads/accounts/{acct}/topup/", {"amount_minor": 50000, "reference": "v1"}, format="json").status_code, 403)  # on ne se credite pas soi-meme
        self.assertEqual(self.ca.post(f"/api/v1/admin/ads/accounts/{acct}/topup/", {"amount_minor": 50000, "reference": "v1"}, format="json").json()["credited"], True)
        self.assertEqual(self.ca.post(f"/api/v1/admin/ads/accounts/{acct}/topup/", {"amount_minor": 50000, "reference": "v1"}, format="json").json()["credited"], False)  # rejeu
        camp = self.cs.post("/api/v1/ads/campaigns/", {"account": acct, "name": "Lancement", "starts_at": (timezone.now() - timedelta(hours=1)).isoformat(), "daily_budget_minor": 1000, "total_budget_minor": 10000}, format="json").json()["id"]
        bad = self.cs.post(f"/api/v1/ads/campaigns/{camp}/ad-sets/", {"name": "x", "bid_minor": 5, "placements": ["feed"], "rules": [{"field": "religion", "values": ["x"]}]}, format="json")
        self.assertEqual(bad.status_code, 400)  # critere sensible refuse des la validation
        st = self.cs.post(f"/api/v1/ads/campaigns/{camp}/ad-sets/", {"name": "Devs Django", "bid_minor": 5, "placements": ["feed"], "rules": [{"field": "skill", "operator": "in", "values": ["django"]}]}, format="json").json()["id"]
        cr = self.cs.post("/api/v1/ads/creatives/", {"account": acct, "headline": "Apprenez Django", "destination_url": "https://baobab.example.com/c"}, format="json").json()["id"]
        self.assertEqual(self.cs.post("/api/v1/ads/creatives/", {"account": acct, "headline": "x", "destination_url": "http://insecure.example.com"}, format="json").status_code, 422)
        ad = self.cs.post(f"/api/v1/ads/ad-sets/{st}/ads/", {"creative": cr}, format="json").json()["id"]
        self.assertEqual(self.co.post(f"/api/v1/ads/ads/{ad}/submit/").status_code, 404)
        self.assertEqual(self.cs.post(f"/api/v1/ads/campaigns/{camp}/activate/").json()["error"]["code"], "no_active_ad")
        self.cs.post(f"/api/v1/ads/ads/{ad}/submit/")
        self.assertEqual(self.cs.post(f"/api/v1/admin/ads/{ad}/review/", {"approve": True}, format="json").status_code, 403)  # l'annonceur ne se valide pas
        self.assertEqual(len(self.ca.get("/api/v1/admin/ads/review-queue/").json()["results"]), 1)
        self.ca.post(f"/api/v1/admin/ads/{ad}/review/", {"approve": True}, format="json")
        self.assertEqual(self.cs.post(f"/api/v1/ads/campaigns/{camp}/activate/").json()["status"], "active")
        dev = api_client(self.buyer)
        dev.put("/api/v1/me/skills/", {"skills": [{"slug": "django", "level": 3}]}, format="json")
        served = dev.get("/api/v1/ads/serve/", {"placement": "feed"}).json()
        self.assertEqual(len(served), 1)
        for secret in ("bid", "budget", "rules", "targeting", "account", "balance"):
            self.assertNotIn(secret, json.dumps(served), secret)  # le client ne voit jamais l'enchere, le budget ni le ciblage
        self.assertEqual(self.co.get("/api/v1/ads/serve/", {"placement": "feed"}).json(), [])  # pas de competence Django : pas d'annonce
        imp = served[0]["impression_id"]
        self.assertEqual(dev.post("/api/v1/ads/impressions/", {"ad": served[0]["id"], "placement": "feed", "impression_id": imp}, format="json").json()["counted"], True)
        self.assertEqual(dev.post("/api/v1/ads/impressions/", {"ad": served[0]["id"], "placement": "feed", "impression_id": imp}, format="json").json()["counted"], False)  # doublon
        self.assertEqual(self.co.post("/api/v1/ads/clicks/", {"impression_id": imp}, format="json").json()["counted"], False)  # clic sur l'impression d'un autre
        click = dev.post("/api/v1/ads/clicks/", {"impression_id": imp}, format="json").json()
        self.assertEqual((click["counted"], click["destination_url"]), (True, "https://baobab.example.com/c"))
        D.settle()
        stats = self.cs.get(f"/api/v1/ads/campaigns/{camp}/stats/").json()
        self.assertEqual((stats["impressions"], stats["clicks"], stats["spend_minor"], stats["wallet_balance_minor"]), (1, 1, 5.0, 49995))
        self.assertEqual(self.co.get(f"/api/v1/ads/campaigns/{camp}/stats/").status_code, 404)
        dev.put("/api/v1/me/ad-preferences/", {"personalized_ads": False}, format="json")
        self.assertEqual(dev.get("/api/v1/ads/serve/", {"placement": "feed"}).json(), [])  # a refuse la publicite personnalisee

    def test_staff_only_admin_endpoints_and_misc(self):
        for path in ("/api/v1/admin/metrics/platform-daily/", "/api/v1/admin/ads/review-queue/", "/api/v1/admin/refunds/", "/api/v1/admin/company-verifications/", "/api/v1/admin/moderation/cases/"):
            self.assertEqual(self.cb.get(path).status_code, 403, path)
            self.assertEqual(self.anon.get(path).status_code, 401, path)
            self.assertEqual(self.ca.get(path).status_code, 200, path)
        self.assertEqual(self.anon.get("/api/v1/integrations/providers/").status_code, 200)
        self.assertEqual(self.cb.get("/api/v1/me/integrations/").json(), [])
