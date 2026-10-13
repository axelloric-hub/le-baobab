"""Donnees utilisees par l'espace membre (lot 2 : messages, profil, notifications).

- boite de reception : dernier message, presence et lecture par l'autre (selon la confidentialite des DEUX) ;
- messages : MES reactions ;
- profil : demande d'ami en attente (sens + id), abonnement reciproque, ami proche, date d'inscription ;
- preferences de notification : canaux par defaut de chaque type.
"""
from unittest import mock

from apps.core import outbox
from apps.core.api_testing import api_client, verified_user
from apps.core.testing import BaobabTestCase


class Lot2Tests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b, self.c = verified_user("alice"), verified_user("bob"), verified_user("carole")
        self.ca, self.cb, self.cc = api_client(self.a), api_client(self.b), api_client(self.c)

    def befriend(self, x, cx, cy, y):
        rid = cx.post("/api/v1/friends/requests/", {"username": y.username}, format="json").json()["id"]
        self.assertEqual(cy.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json").status_code, 200)

    def test_inbox_preview_presence_and_receipts(self):
        self.befriend(self.a, self.ca, self.cb, self.b)
        cid = self.ca.post("/api/v1/conversations/direct/", {"username": "bob"}, format="json").json()["id"]
        r = self.ca.post(f"/api/v1/conversations/{cid}/messages/", {"body": "Salut Bob, tu as vu la PR ?"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        with mock.patch("apps.core.redis.is_online", return_value=True):
            item = self.cb.get("/api/v1/conversations/").json()[0]
        self.assertEqual((item["last_message"]["body"], item["last_message"]["sender"], item["unread"]), ("Salut Bob, tu as vu la PR ?", "alice", 1))
        self.assertTrue(item["with"]["online"])
        self.assertEqual(item["others_read_seq"], 1)  # Alice a lu son propre message
        seq = r.json()["seq"]
        self.assertEqual(self.ca.get("/api/v1/conversations/").json()[0]["others_read_seq"], 0)
        self.cb.post(f"/api/v1/conversations/{cid}/read/", {"up_to_seq": seq}, format="json")
        self.assertEqual(self.ca.get("/api/v1/conversations/").json()[0]["others_read_seq"], seq)
        # Bob masque ses accuses de lecture : Alice ne voit plus rien, et Bob non plus (reciprocite).
        self.cb.patch("/api/v1/me/privacy/", {"show_read_receipts": False, "show_presence": False}, format="json")
        with mock.patch("apps.core.redis.is_online", return_value=True):
            item = self.ca.get("/api/v1/conversations/").json()[0]
        self.assertIsNone(item["others_read_seq"])
        self.assertFalse(item["with"]["online"])
        self.assertIsNone(self.cb.get("/api/v1/conversations/").json()[0]["others_read_seq"])

    def test_my_reactions_on_messages(self):
        self.befriend(self.a, self.ca, self.cb, self.b)
        cid = self.ca.post("/api/v1/conversations/direct/", {"username": "bob"}, format="json").json()["id"]
        mid = self.ca.post(f"/api/v1/conversations/{cid}/messages/", {"body": "Bonjour"}, format="json").json()["id"]
        self.cb.post(f"/api/v1/messages/{mid}/reactions/", {"emoji": "👍"}, format="json")
        mine = self.cb.get(f"/api/v1/conversations/{cid}/messages/").json()["results"][0]
        theirs = self.ca.get(f"/api/v1/conversations/{cid}/messages/").json()["results"][0]
        self.assertEqual((mine["reactions"], mine["my_reactions"], theirs["my_reactions"]), ({"👍": 1}, ["👍"], []))

    def test_profile_relation_states(self):
        r = self.ca.get("/api/v1/users/bob/").json()
        self.assertIn("joined_at", r)
        self.assertEqual(r["relation"], {"is_friend": False, "is_following": False, "follows_me": False, "friend_request": None, "is_close_friend": False})
        rid = self.ca.post("/api/v1/friends/requests/", {"username": "bob"}, format="json").json()["id"]
        self.assertEqual(self.ca.get("/api/v1/users/bob/").json()["relation"]["friend_request"], {"id": rid, "direction": "sent"})
        self.assertEqual(self.cb.get("/api/v1/users/alice/").json()["relation"]["friend_request"], {"id": rid, "direction": "received"})
        self.cb.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json")
        self.cb.post("/api/v1/users/alice/follow/", {}, format="json")
        self.ca.post("/api/v1/users/bob/close-friend/", {}, format="json")
        rel = self.ca.get("/api/v1/users/bob/").json()["relation"]
        self.assertEqual((rel["is_friend"], rel["follows_me"], rel["friend_request"], rel["is_close_friend"]), (True, True, None, True))
        self.assertNotIn("relation", self.ca.get("/api/v1/users/alice/").json())  # mon propre profil

    def test_notification_preferences_expose_default_channels(self):
        types = {t["code"]: t for t in self.ca.get("/api/v1/notifications/preferences/").json()["types"]}
        self.assertIn("in_app", types["comment"]["default_channels"])

    def test_friend_request_notification_targets_request(self):
        rid = self.ca.post("/api/v1/friends/requests/", {"username": "carole"}, format="json").json()["id"]
        outbox.relay_batch(500)
        n = self.cc.get("/api/v1/notifications/").json()["results"][0]
        self.assertEqual((n["type"], n["target_id"], n["actor"]["username"]), ("friend_request", rid, "alice"))

    def test_empty_portfolio_is_readable_not_hidden(self):
        r = self.ca.get("/api/v1/users/bob/portfolio/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.json()["projects"], r.json()["experiences"]), ([], []))
        self.assertEqual(self.cb.get("/api/v1/users/bob/portfolio/").status_code, 200)  # le mien aussi
