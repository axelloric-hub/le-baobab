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
