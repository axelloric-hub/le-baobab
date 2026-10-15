"""Donnees utilisees par les applications de l'espace membre livrees au lot 3 (Communaute, Opportunites, Learn, Showcase, Boutique).

Communaute :
- detail d'un groupe : mes permissions (pour n'afficher que les actions autorisees) et date de creation ;
- creation : compteur de membres a jour, adresse deja prise -> 409 slug_taken (et non une erreur 500) ;
- modification (permission group.edit) sans jamais changer la confidentialite ;
- publications d'un groupe : visibles selon la confidentialite, jamais pour un non-membre d'un groupe prive.
"""
from apps.core.api_testing import api_client, verified_user
from apps.core.testing import BaobabTestCase


class CommunityLot3Tests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b = verified_user("alice"), verified_user("bob")
        self.ca, self.cb = api_client(self.a), api_client(self.b)

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
