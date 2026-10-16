"""Donnees utilisees par les applications de l'espace membre livrees au lot 3 (Communaute, Opportunites, Learn, Showcase, Boutique).

Communaute :
- detail d'un groupe : mes permissions (pour n'afficher que les actions autorisees) et date de creation ;
- creation : compteur de membres a jour, adresse deja prise -> 409 slug_taken (et non une erreur 500) ;
- modification (permission group.edit) sans jamais changer la confidentialite ;
- publications d'un groupe : visibles selon la confidentialite, jamais pour un non-membre d'un groupe prive.
"""
from apps.core import outbox
from apps.core.api_testing import api_client, upload_file, verified_user
from apps.core.testing import BaobabTestCase


class CommunityLot3Tests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b = verified_user("alice"), verified_user("bob")
        self.ca, self.cb = api_client(self.a), api_client(self.b)

    def relay(self):
        outbox.relay_batch(500)

    def create(self, slug, **extra):
        r = self.ca.post("/api/v1/groups/", {"name": f"Groupe {slug}", "slug": slug, **extra}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def test_create_returns_count_permissions_and_rejects_duplicate_slug(self):
        g = self.create("django-douala")
        self.assertEqual((g["member_count"], g["my_role"]), (1, "owner"))
        self.assertIn("group.edit", g["my_permissions"])
        self.assertIn("created_at", g)
        r = self.ca.post("/api/v1/groups/", {"name": "Autre", "slug": "django-douala"}, format="json")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (409, "slug_taken"))
        # Un non-membre n'a aucune permission ; un membre a les permissions du role par defaut.
        self.assertEqual(self.cb.get("/api/v1/groups/django-douala/").json()["my_permissions"], [])
        self.cb.post("/api/v1/groups/django-douala/join/", {}, format="json")
        self.assertEqual(self.cb.get("/api/v1/groups/django-douala/").json()["my_permissions"], ["comment.create", "post.create"])

    def test_update_requires_permission_and_never_changes_privacy(self):
        self.create("prive", privacy="private", join_policy="approval")
        self.assertEqual(self.cb.patch("/api/v1/groups/prive/", {"name": "Pirate"}, format="json").status_code, 403)  # prive mais visible : refus explicite
        r = self.ca.patch("/api/v1/groups/prive/", {"name": "Nouveau nom", "description": "Bienvenue", "join_policy": "invite_only", "privacy": "public"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        g = r.json()
        self.assertEqual((g["name"], g["description"], g["join_policy"], g["privacy"]), ("Nouveau nom", "Bienvenue", "invite_only", "private"))
        self.create("public")
        self.cb.post("/api/v1/groups/public/join/", {}, format="json")
        self.assertEqual(self.cb.patch("/api/v1/groups/public/", {"name": "Pirate"}, format="json").status_code, 403)

    def test_update_group_photos(self):
        self.create("photos")
        fid = upload_file(self.ca, "avatar")
        g = self.ca.patch("/api/v1/groups/photos/", {"avatar_file": fid}, format="json").json()
        self.assertTrue(g["avatar_url"])
        self.assertIsNone(self.ca.patch("/api/v1/groups/photos/", {"avatar_file": None}, format="json").json()["avatar_url"])
        other = upload_file(self.cb, "avatar")  # le fichier d'un autre membre est refuse
        self.assertEqual(self.ca.patch("/api/v1/groups/photos/", {"cover_file": other}, format="json").json()["error"]["code"], "invalid_file")

    def test_invitation_and_approval_notify(self):
        self.create("notif", privacy="private", join_policy="approval")
        self.ca.post("/api/v1/groups/notif/invite/", {"username": "bob"}, format="json")
        self.relay()
        n = self.cb.get("/api/v1/notifications/").json()["results"][0]
        self.assertEqual((n["type"], n["data"]["group"], n["data"]["group_name"]), ("group_invitation", "notif", "Groupe notif"))
        c = verified_user("carole")
        cc = api_client(c)
        cc.post("/api/v1/groups/notif/join/", {}, format="json")
        rid = self.ca.get("/api/v1/groups/notif/join-requests/").json()[0]["id"]
        self.ca.post(f"/api/v1/group-join-requests/{rid}/review/", {"approve": True}, format="json")
        self.relay()
        self.assertEqual(cc.get("/api/v1/notifications/").json()["results"][0]["type"], "group_join_approved")

    def test_group_posts_follow_group_privacy(self):
        self.create("ouvert")
        self.create("ferme", privacy="private", join_policy="approval")
        for slug in ("ouvert", "ferme"):
            r = self.ca.post("/api/v1/posts/", {"kind": "text", "body": f"Bonjour {slug}", "group": slug, "visibility": "public"}, format="json")
            self.assertEqual(r.status_code, 201, r.content)
        self.ca.post("/api/v1/posts/", {"kind": "text", "body": "Hors groupe"}, format="json")
        bodies = [p["body"] for p in self.cb.get("/api/v1/groups/ouvert/posts/").json()["results"]]
        self.assertEqual(bodies, ["Bonjour ouvert"])
        self.assertEqual(self.cb.get("/api/v1/groups/ferme/posts/").status_code, 404)
        self.assertEqual([p["body"] for p in self.ca.get("/api/v1/groups/ferme/posts/").json()["results"]], ["Bonjour ferme"])
        self.assertEqual(self.ca.get("/api/v1/groups/ferme/posts/").json()["results"][0]["visibility"], "group_members")


class JobsLot3Tests(BaobabTestCase):
    """Opportunites : etat du lecteur sur chaque offre, mes annonces avec compteurs, modification d'une offre, role dans l'entreprise."""

    def setUp(self):
        super().setUp()
        from apps.jobs.testing import make_company_job

        self.f = make_company_job()
        self.cr = api_client(self.f.recruiter)
        self.cand = verified_user("candidate")
        self.cc = api_client(self.cand)

    def test_viewer_state_on_list_and_detail(self):
        jid = str(self.f.job.pk)
        item = self.cc.get("/api/v1/jobs/").json()["results"][0]
        self.assertEqual(item["viewer"], {"can_manage": False, "application": None, "proposal": None})
        self.assertEqual((item["company"]["name"], item["skills"][0]["name"], item["posted_by"]["username"]), ("Afrik Tech", "Django", self.f.recruiter.username))
        app = self.cc.post(f"/api/v1/jobs/{jid}/apply/", {"cover_letter": "Bonjour"}, format="json").json()
        self.assertEqual(self.cc.get(f"/api/v1/jobs/{jid}/").json()["viewer"]["application"], {"id": app["id"], "status": "submitted"})
        self.assertTrue(self.cr.get(f"/api/v1/jobs/{jid}/").json()["viewer"]["can_manage"])
        self.assertIsNone(api_client(None).get(f"/api/v1/jobs/{jid}/").json()["viewer"])  # anonyme : aucun etat

    def test_my_jobs_lists_drafts_with_counts_only_for_managers(self):
        jid = str(self.f.job.pk)
        self.cc.post(f"/api/v1/jobs/{jid}/apply/", {"cover_letter": "Bonjour"}, format="json")
        draft = self.cr.post("/api/v1/jobs/", {"company": self.f.company.slug, "title": "Brouillon", "description": "x" * 60, "job_type": "full_time", "contract_type": "permanent"}, format="json").json()
        mine = {j["id"]: j for j in self.cr.get("/api/v1/me/jobs/").json()["results"]}
        self.assertEqual(mine[jid]["counts"], {"applications": 1, "new_applications": 1, "proposals": 0})
        self.assertEqual(mine[draft["id"]]["status"], "draft")
        self.assertEqual(self.cc.get("/api/v1/me/jobs/").json()["results"], [])

    def test_update_job_rules(self):
        jid = str(self.f.job.pk)
        self.assertEqual(self.cc.patch(f"/api/v1/jobs/{jid}/", {"title": "Pirate"}, format="json").status_code, 404)
        r = self.cr.patch(f"/api/v1/jobs/{jid}/", {"title": "Dev Django senior", "remote_policy": "remote", "salary": None, "skills": [{"slug": "python", "required": False}]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        j = r.json()
        self.assertEqual((j["title"], j["remote_policy"], j["salary"], j["skills"][0]["slug"], j["skills"][0]["required"]), ("Dev Django senior", "remote", None, "python", False))
        # Une offre ouverte doit garder une description detaillee et au moins une competence.
        self.assertEqual(self.cr.patch(f"/api/v1/jobs/{jid}/", {"skills": []}, format="json").json()["error"]["code"], "incomplete_job")
        self.cr.post(f"/api/v1/jobs/{jid}/close/", {"filled": True}, format="json")
        self.assertEqual(self.cr.patch(f"/api/v1/jobs/{jid}/", {"title": "Trop tard"}, format="json").json()["error"]["code"], "invalid_state")

    def test_application_carries_interviews_and_offer(self):
        jid = str(self.f.job.pk)
        aid = self.cc.post(f"/api/v1/jobs/{jid}/apply/", {"cover_letter": "Bonjour"}, format="json").json()["id"]
        for to in ("reviewing", "shortlisted"):
            self.cr.post(f"/api/v1/applications/{aid}/transition/", {"to_status": to}, format="json")
        slot = self.cr.post(f"/api/v1/jobs/{jid}/slots/", {"starts_at": "2031-01-10T09:00:00Z", "ends_at": "2031-01-10T10:00:00Z"}, format="json").json()
        self.cc.post(f"/api/v1/applications/{aid}/book/", {"slot": slot["id"]}, format="json")
        self.cr.post(f"/api/v1/applications/{aid}/offer/", {"amount_minor": 500000, "currency": "XAF"}, format="json")
        a = self.cc.get(f"/api/v1/applications/{aid}/").json()
        self.assertEqual((a["status"], a["interviews"][0]["starts_at"][:10], a["offer"]["amount_minor"], a["job"]["company"]["name"]), ("offer", "2031-01-10", 500000, "Afrik Tech"))

    def test_company_detail_shows_my_role(self):
        slug = self.f.company.slug
        self.assertEqual(self.cr.get(f"/api/v1/companies/{slug}/").json()["my_role"], "recruiter")
        self.assertIsNone(self.cc.get(f"/api/v1/companies/{slug}/").json()["my_role"])
        self.assertIsNone(api_client(None).get(f"/api/v1/companies/{slug}/").json()["my_role"])


class LearnLot3Tests(BaobabTestCase):
    """Learn : plan du cours dans l'ordre des positions, ma progression par chapitre, statistiques, cours enseignes, modification."""

    def setUp(self):
        super().setUp()
        self.t, self.s = verified_user("teacher"), verified_user("student")
        self.ct, self.cs = api_client(self.t), api_client(self.s)
        self.ct.post("/api/v1/classrooms/", {"title": "Classe", "slug": "classe"}, format="json")
        self.cid = self.ct.post("/api/v1/classrooms/classe/courses/", {"title": "Cours", "slug": "cours"}, format="json").json()["id"]
        mid = self.ct.post(f"/api/v1/courses/{self.cid}/modules/", {"title": "M1"}, format="json").json()["id"]
        self.chapters = [self.ct.post(f"/api/v1/modules/{mid}/chapters/", {"title": f"C{i}", "estimated_minutes": 10}, format="json").json()["id"] for i in range(1, 6)]
        for i, ch in enumerate(self.chapters):
            for j in range(3):
                self.ct.post(f"/api/v1/chapters/{ch}/blocks/", {"kind": "text", "body": f"bloc {j}"}, format="json")

    def test_outline_is_ordered_and_carries_my_progress(self):
        self.assertEqual(self.cs.get(f"/api/v1/courses/{self.cid}/").status_code, 404)  # brouillon : invisible pour un eleve
        draft = self.ct.get(f"/api/v1/courses/{self.cid}/").json()
        self.assertTrue(draft["is_staff"])
        self.assertEqual(draft["stats"], {"modules": 1, "chapters": 5, "minutes": 50})
        self.ct.post(f"/api/v1/courses/{self.cid}/publish/", {}, format="json")
        self.cs.post(f"/api/v1/courses/{self.cid}/enroll/", {}, format="json")
        self.cs.post(f"/api/v1/chapters/{self.chapters[0]}/progress/", {"percent": 100}, format="json")
        o = self.cs.get(f"/api/v1/courses/{self.cid}/").json()
        chs = o["modules"][0]["chapters"]
        self.assertEqual([c["title"] for c in chs], ["C1", "C2", "C3", "C4", "C5"])
        self.assertEqual((chs[0]["my_progress"]["status"], chs[1]["my_progress"]), ("completed", None))
        self.assertEqual((o["is_staff"], o["enrolled"], o["progress"]["completed_chapters"]), (False, True, 1))
        blocks = self.cs.get(f"/api/v1/chapters/{self.chapters[2]}/content/").json()["blocks"]
        self.assertEqual([b["body"] for b in blocks], ["bloc 0", "bloc 1", "bloc 2"])

    def test_teaching_list_and_course_update(self):
        mine = self.ct.get("/api/v1/me/teaching/").json()["results"]
        self.assertEqual((mine[0]["id"], mine[0]["status"], mine[0]["stats"]["chapters"]), (self.cid, "draft", 5))
        self.assertEqual(self.cs.get("/api/v1/me/teaching/").json()["results"], [])
        r = self.ct.patch(f"/api/v1/courses/{self.cid}/", {"title": "Nouveau titre", "level": "advanced"}, format="json")
        self.assertEqual((r.status_code, r.json()["title"], r.json()["level"]), (200, "Nouveau titre", "advanced"))
        self.ct.post(f"/api/v1/courses/{self.cid}/publish/", {}, format="json")
        self.cs.post(f"/api/v1/courses/{self.cid}/enroll/", {}, format="json")
        self.assertEqual(self.cs.patch(f"/api/v1/courses/{self.cid}/", {"title": "Pirate"}, format="json").status_code, 403)

    def test_classroom_detail_shows_drafts_to_staff_only(self):
        self.assertEqual(len(self.ct.get("/api/v1/classrooms/classe/").json()["courses"]), 1)
        d = self.cs.get("/api/v1/classrooms/classe/").json()
        self.assertEqual((d["courses"], d["is_staff"], d["owner"]["username"]), ([], False, "teacher"))

    def test_quiz_questions_keep_their_order(self):
        qid = self.ct.post(f"/api/v1/courses/{self.cid}/quizzes/", {"title": "Q"}, format="json").json()["id"]
        for i in range(4):
            self.ct.post(f"/api/v1/quizzes/{qid}/questions/", {"kind": "single", "prompt": f"P{i}", "choices": [{"label": f"{i}a", "is_correct": True}, {"label": f"{i}b", "is_correct": False}]}, format="json")
        quiz = self.ct.get(f"/api/v1/quizzes/{qid}/").json()
        self.assertEqual([q["prompt"] for q in quiz["questions"]], ["P0", "P1", "P2", "P3"])
        self.assertEqual([c["label"] for c in quiz["questions"][2]["choices"]], ["2a", "2b"])
        listed = self.ct.get(f"/api/v1/courses/{self.cid}/quizzes/").json()
        self.assertEqual((listed[0]["questions"], listed[0]["is_published"]), (4, False))


class ShowcaseLot3Tests(BaobabTestCase):
    """Showcase : vitrine des projets selon la confidentialite du portfolio, filtres reels, detail, edition par l'auteur seulement."""

    def setUp(self):
        super().setUp()
        self.a, self.b, self.c = verified_user("awa"), verified_user("bakary"), verified_user("chidi")
        self.ca, self.cb, self.cc = api_client(self.a), api_client(self.b), api_client(self.c)
        from rest_framework.test import APIClient

        self.anon = APIClient()

    def project(self, client, title, **extra):
        r = client.post("/api/v1/me/portfolio/projects/", {"slug": title.lower().replace(" ", "-"), "title": title, **extra}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()["id"]

    def titles(self, client, **params):
        return [p["title"] for p in client.get("/api/v1/showcase/projects/", params).json()["results"]]

    def test_showcase_respects_portfolio_visibility_and_filters(self):
        pa = self.project(self.ca, "Paiement mobile", technologies=["django", "python"], description="API de paiement")
        self.project(self.cb, "Carte des marches", technologies=["python"])
        self.cb.patch("/api/v1/me/portfolio/", {"visibility": "followers"}, format="json")
        self.assertEqual(set(self.titles(self.anon)), {"Paiement mobile"})
        self.assertEqual(set(self.titles(self.cc)), {"Paiement mobile"})
        self.cc.post(f"/api/v1/users/{self.b.username}/follow/", {}, format="json")
        self.assertEqual(set(self.titles(self.cc)), {"Paiement mobile", "Carte des marches"})
        self.assertEqual(set(self.titles(self.cb)), {"Paiement mobile", "Carte des marches"})  # l'auteur voit toujours les siens
        self.assertEqual(self.titles(self.cc, tech="django"), ["Paiement mobile"])
        self.assertEqual(self.titles(self.cc, q="paiement"), ["Paiement mobile"])
        self.assertEqual(self.titles(self.cc, user=self.b.username), ["Carte des marches"])
        item = self.anon.get("/api/v1/showcase/projects/").json()["results"][0]
        self.assertEqual((item["owner"]["username"], {t["name"] for t in item["technologies"]}), (self.a.username, {"Django", "Python"}))
        techs = {t["slug"]: t["projects"] for t in self.cc.get("/api/v1/showcase/technologies/").json()}
        self.assertEqual((techs["python"], techs["django"]), (2, 1))
        self.assertEqual({t["slug"] for t in self.anon.get("/api/v1/showcase/technologies/").json()}, {"django", "python"})
        d = self.cc.get(f"/api/v1/showcase/projects/{pa}/").json()
        self.assertEqual((d["is_mine"], d["more"]), (False, []))
        self.assertTrue(self.ca.get(f"/api/v1/showcase/projects/{pa}/").json()["is_mine"])
        self.ca.patch("/api/v1/me/portfolio/", {"visibility": "private"}, format="json")
        self.assertEqual(self.cc.get(f"/api/v1/showcase/projects/{pa}/").status_code, 404)

    def test_owner_edits_project_links_and_media(self):
        pid = self.project(self.ca, "Bot WhatsApp", links=[{"kind": "demo", "url": "https://bot.example.com"}])
        r = self.ca.patch(f"/api/v1/me/portfolio/projects/{pid}/", {"title": "Bot WhatsApp v2", "is_featured": True, "technologies": ["python"], "started_on": "2025-01-01", "ended_on": None}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.json()["title"], r.json()["is_featured"], [t["slug"] for t in r.json()["technologies"]]), ("Bot WhatsApp v2", True, ["python"]))
        bad = self.ca.patch(f"/api/v1/me/portfolio/projects/{pid}/", {"ended_on": "2024-01-01"}, format="json")
        self.assertEqual(bad.json()["error"]["code"], "invalid_dates")
        self.assertEqual(self.cb.patch(f"/api/v1/me/portfolio/projects/{pid}/", {"title": "Pirate"}, format="json").status_code, 404)
        fid = upload_file(self.ca, "portfolio_media")
        self.assertEqual(self.ca.post(f"/api/v1/me/portfolio/projects/{pid}/media/", {"file": fid}, format="json").status_code, 201)
        d = self.ca.get(f"/api/v1/showcase/projects/{pid}/").json()
        media, link = d["media"][0]["id"], d["links"][0]["id"]
        self.assertEqual(self.cb.delete(f"/api/v1/me/portfolio/projects/{pid}/media/{media}/").status_code, 404)
        self.assertEqual(self.ca.delete(f"/api/v1/me/portfolio/projects/{pid}/media/{media}/").status_code, 204)
        self.assertEqual(self.ca.delete(f"/api/v1/me/portfolio/projects/{pid}/links/{link}/").status_code, 204)
        d = self.ca.get(f"/api/v1/showcase/projects/{pid}/").json()
        self.assertEqual((d["media"], d["links"]), ([], []))
        self.assertEqual(self.cb.delete(f"/api/v1/me/portfolio/projects/{pid}/").status_code, 404)
        self.assertEqual(self.ca.delete(f"/api/v1/me/portfolio/projects/{pid}/").status_code, 204)
        self.assertEqual(self.ca.get(f"/api/v1/showcase/projects/{pid}/").status_code, 404)


from django.test import override_settings  # noqa: E402


@override_settings(PAYMENTS_SIMULATION_ENABLED=True)
class BoutiqueLot3Tests(BaobabTestCase):
    """Boutique : boutique et brouillons du vendeur, fiche produit enrichie (etat de l'acheteur, cibles), parcours d'achat simule, ventes du vendeur."""

    def setUp(self):
        super().setUp()
        self.s, self.b = verified_user("sena"), verified_user("bilal")
        self.cs, self.cb = api_client(self.s), api_client(self.b)
        from rest_framework.test import APIClient

        self.anon = APIClient()

    def relay(self):
        outbox.relay_batch(500)

    def shop(self):
        self.assertEqual(self.cs.post("/api/v1/stores/", {"name": "Kits Dev", "slug": "kits-dev"}, format="json").status_code, 201)
        pid = self.cs.post("/api/v1/stores/kits-dev/products/", {"kind": "template", "slug": "kit-django", "title": "Kit Django", "description": "Un  kit   complet"}, format="json").json()["id"]
        vid = self.cs.post(f"/api/v1/products/{pid}/variants/", {"sku": "KIT-1", "name": "Standard", "price_minor": 5000, "currency": "XAF"}, format="json").json()["id"]
        return pid, vid

    def test_store_owner_sees_drafts_and_edits(self):
        pid, vid = self.shop()
        st = self.cs.get("/api/v1/stores/kits-dev/").json()
        self.assertEqual((st["is_mine"], st["product_count"], st["products"][0]["status"]), (True, 1, "draft"))
        self.assertEqual(self.cb.get("/api/v1/stores/kits-dev/").json()["products"], [])
        self.assertEqual(self.cb.get(f"/api/v1/products/{pid}/").status_code, 404)
        r = self.cs.patch(f"/api/v1/products/{pid}/", {"title": "Kit Django Pro", "skills": ["django"]}, format="json").json()
        self.assertEqual((r["title"], r["skills"][0]["slug"], r["is_mine"], r["excerpt"]), ("Kit Django Pro", "django", True, "Un kit complet"))
        v = self.cs.patch(f"/api/v1/products/{pid}/variants/{vid}/", {"price_minor": 7000, "stock": 3}, format="json").json()
        self.assertEqual((v["price_minor"], v["stock"]), (7000, 3))
        self.assertEqual(self.cb.patch(f"/api/v1/products/{pid}/", {"title": "Pirate"}, format="json").status_code, 404)
        self.assertEqual(self.cs.patch("/api/v1/stores/kits-dev/", {"description": "Outils"}, format="json").json()["description"], "Outils")
        self.assertEqual(self.cb.patch("/api/v1/stores/kits-dev/", {"description": "x"}, format="json").status_code, 404)
        self.cs.post(f"/api/v1/products/{pid}/publish/", {}, format="json")
        p = self.anon.get(f"/api/v1/products/{pid}/").json()
        self.assertNotIn("stock", p["variants"][0])  # le stock exact reste confidentiel
        self.assertEqual((p["purchased"], p["in_wishlist"], p["targets"]), (False, False, []))
        self.assertEqual([x["title"] for x in self.anon.get("/api/v1/products/", {"skill": "django"}).json()["results"]], ["Kit Django Pro"])
        self.assertEqual(self.anon.get("/api/v1/products/", {"q": "complet"}).json()["results"][0]["id"], pid)
        self.cs.patch(f"/api/v1/products/{pid}/", {"status": "draft"}, format="json")
        self.assertEqual(self.anon.get("/api/v1/products/").json()["results"], [])

    def test_purchase_flow_with_simulation_and_sales(self):
        pid, vid = self.shop()
        self.cs.post(f"/api/v1/products/{pid}/publish/", {}, format="json")
        self.assertTrue(self.cb.get("/api/v1/payments/config/").json()["simulation"])
        cart = self.cb.post("/api/v1/cart/items/", {"variant": vid, "quantity": 2}, format="json").json()
        self.assertEqual((cart["count"], cart["subtotal_minor"], cart["items"][0]["product_id"], cart["items"][0]["store"]["slug"]), (2, 10000, pid, "kits-dev"))
        order = self.cb.post("/api/v1/checkout/", {"idempotency_key": "o-1"}, format="json").json()
        self.assertEqual((order["items"][0]["product"], order["items"][0]["shop"]["name"], order["payment"]), (pid, "Kits Dev", None))
        pay = self.cb.post("/api/v1/payments/start/", {"order": order["id"], "provider": "manual"}, format="json").json()
        self.assertTrue(pay["simulation"])
        done = self.cb.post(f"/api/v1/payments/{pay['id']}/simulate/", {"outcome": "succeeded"}, format="json").json()
        self.assertEqual(done["order"]["status"], "paid")
        self.assertEqual(self.cb.get(f"/api/v1/orders/{order['id']}/").json()["payment"]["status"], "succeeded")
        p = self.cb.get(f"/api/v1/products/{pid}/").json()
        self.assertEqual((p["purchased"], p["my_review"]), (True, False))
        self.assertEqual(self.cb.post(f"/api/v1/products/{pid}/reviews/", {"rating": 5, "title": "Top"}, format="json").status_code, 201)
        self.assertTrue(self.cb.get(f"/api/v1/products/{pid}/").json()["my_review"])
        sales = self.cs.get("/api/v1/stores/kits-dev/sales/").json()["results"]
        self.assertEqual((len(sales), sales[0]["quantity"], sales[0]["buyer"]["username"], sales[0]["order_number"]), (1, 2, self.b.username, order["number"]))
        self.assertEqual(self.cb.get("/api/v1/stores/kits-dev/sales/").status_code, 404)
        self.relay()
        from apps.notifications.models import Notification

        n = Notification.objects.get(recipient=self.s, type__code="new_sale")
        self.assertEqual(n.data["store"], "kits-dev")

    def test_course_product_targets_are_labelled_and_filterable(self):
        cls = self.cs.post("/api/v1/classrooms/", {"title": "Ecole", "slug": "ecole-kits"}, format="json").json()
        course = self.cs.post("/api/v1/classrooms/ecole-kits/courses/", {"title": "Django avance", "slug": "django-avance"}, format="json").json()
        self.cs.post("/api/v1/stores/", {"name": "Ecole", "slug": "ecole-shop"}, format="json")
        pid = self.cs.post("/api/v1/stores/ecole-shop/products/", {"kind": "course", "slug": "acces", "title": "Acces Django avance"}, format="json").json()["id"]
        self.cs.post(f"/api/v1/products/{pid}/variants/", {"sku": "ACC-1", "name": "Acces", "price_minor": 0, "currency": "XAF"}, format="json")
        self.assertEqual(self.cs.post(f"/api/v1/products/{pid}/entitlement-targets/", {"scope": "course", "target_id": course["id"]}, format="json").status_code, 201)
        self.cs.post(f"/api/v1/products/{pid}/publish/", {}, format="json")
        t = self.anon.get(f"/api/v1/products/{pid}/").json()["targets"][0]
        self.assertEqual((t["scope"], t["label"], t["course"]), ("course", "Django avance", course["id"]))
        self.assertEqual([x["id"] for x in self.anon.get("/api/v1/products/", {"target": course["id"]}).json()["results"]], [pid])
        self.assertEqual([x["id"] for x in self.anon.get("/api/v1/products/", {"course": course["id"]}).json()["results"]], [pid])
        self.assertEqual(self.cs.delete(f"/api/v1/products/{pid}/entitlement-targets/{t['id']}/").json()["error"]["code"], "no_target")
        self.assertTrue(cls)
