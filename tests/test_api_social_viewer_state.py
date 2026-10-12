"""Etat propre au lecteur dans les reponses sociales : utilise par l'espace membre du frontend.

- le fil indique MA reaction, si j'ai ENREGISTRE la publication, et le groupe (slug + nom) ;
- un sondage expose sa question, ses options (avec le nombre de votes) et MES votes, dans le fil et en lecture ;
- un statut indique si je l'ai deja vu (et mes propres statuts comptent comme vus) ;
- un commentaire (et une reponse) indique MA reaction.
"""
from apps.core import outbox
from apps.core.api_testing import api_client, verified_user
from apps.core.testing import BaobabTestCase
from apps.storage.backends import FakeBackend


class ViewerStateTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        FakeBackend.reset()
        self.a, self.b = verified_user("alice"), verified_user("bob")
        self.ca, self.cb = api_client(self.a), api_client(self.b)
        rid = self.ca.post("/api/v1/friends/requests/", {"username": "bob"}, format="json").json()["id"]
        self.assertEqual(self.cb.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json").status_code, 200)

    def feed(self, client):
        outbox.relay_batch(500)
        r = client.get("/api/v1/feed/")
        self.assertEqual(r.status_code, 200, r.content)
        return {c["id"]: c for c in r.json()["results"]}

    def test_feed_reports_my_reaction_and_saved_state(self):
        pid = self.cb.post("/api/v1/posts/", {"body": "Bonjour #baobab", "visibility": "friends"}, format="json").json()["id"]
        card = self.feed(self.ca)[pid]
        self.assertEqual((card["my_reaction"], card["saved"], card["poll"], card["group"]), (None, False, None, None))
        self.assertEqual(self.ca.post(f"/api/v1/posts/{pid}/reactions/", {"type": "celebrate"}, format="json").status_code, 200)
        self.assertEqual(self.ca.post(f"/api/v1/posts/{pid}/save/", {}, format="json").status_code, 201)
        card = self.feed(self.ca)[pid]
        self.assertEqual((card["my_reaction"], card["saved"]), ("celebrate", True))
        self.assertIsNone(self.feed(self.cb)[pid]["my_reaction"])  # l'etat d'Alice ne fuit pas chez Bob

    def test_poll_is_readable_and_votable_from_feed_and_detail(self):
        body = {"kind": "poll", "body": "Votre base ?", "visibility": "friends",
                "poll": {"question": "Quelle base ?", "options": ["PostgreSQL", "MongoDB", "SQLite"]}}
        r = self.cb.post("/api/v1/posts/", body, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        poll = r.json()["poll"]
        self.assertEqual((poll["question"], [o["label"] for o in poll["options"]], poll["total_votes"], poll["my_votes"]),
                         ("Quelle base ?", ["PostgreSQL", "MongoDB", "SQLite"], 0, []))
        pid, first = r.json()["id"], poll["options"][0]["id"]
        self.assertEqual(self.feed(self.ca)[pid]["poll"]["options"][0]["id"], first)
        self.assertEqual(self.ca.post(f"/api/v1/posts/{pid}/poll/vote/", {"options": [first]}, format="json").status_code, 200)
        detail = self.ca.get(f"/api/v1/posts/{pid}/").json()["poll"]
        self.assertEqual((detail["options"][0]["votes"], detail["total_votes"], detail["my_votes"]), (1, 1, [first]))
        self.assertEqual(self.feed(self.ca)[pid]["poll"]["my_votes"], [first])
        self.assertEqual(self.cb.get(f"/api/v1/posts/{pid}/").json()["poll"]["my_votes"], [])
        self.assertIsNone(self.ca.get(f"/api/v1/posts/{pid}/").json()["group"])

    def test_status_viewed_flag(self):
        sid = self.cb.post("/api/v1/statuses/", {"kind": "text", "body": "Hello", "visibility": "friends"}, format="json").json()["id"]
        mine = {s["id"]: s for s in self.cb.get("/api/v1/statuses/").json()}
        self.assertTrue(mine[sid]["viewed"])  # mes propres statuts ne sont jamais « non vus »
        theirs = {s["id"]: s for s in self.ca.get("/api/v1/statuses/").json()}
        self.assertEqual((theirs[sid]["viewed"], theirs[sid]["visibility"]), (False, "friends"))
        self.assertEqual(self.ca.post(f"/api/v1/statuses/{sid}/view/").status_code, 202)
        self.assertTrue({s["id"]: s for s in self.ca.get("/api/v1/statuses/").json()}[sid]["viewed"])

    def test_comments_report_my_reaction(self):
        pid = self.cb.post("/api/v1/posts/", {"body": "Question", "visibility": "friends"}, format="json").json()["id"]
        cid = self.cb.post(f"/api/v1/posts/{pid}/comments/", {"body": "Racine"}, format="json").json()["id"]
        rid = self.ca.post(f"/api/v1/posts/{pid}/comments/", {"body": "Reponse", "parent": cid}, format="json").json()["id"]
        self.assertEqual(self.ca.post(f"/api/v1/comments/{cid}/reactions/", {"type": "insightful"}, format="json").status_code, 200)
        self.assertEqual(self.ca.post(f"/api/v1/comments/{rid}/reactions/", {"type": "like"}, format="json").status_code, 200)
        roots = self.ca.get(f"/api/v1/posts/{pid}/comments/").json()["results"]
        self.assertEqual([(c["id"], c["my_reaction"]) for c in roots], [(cid, "insightful")])
        self.assertEqual(self.ca.get(f"/api/v1/comments/{cid}/replies/").json()["results"][0]["my_reaction"], "like")
        self.assertIsNone(self.cb.get(f"/api/v1/posts/{pid}/comments/").json()["results"][0]["my_reaction"])
