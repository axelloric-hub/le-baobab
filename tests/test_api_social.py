from apps.core import outbox
from apps.core.api_testing import api_client, upload_file, verified_user
from apps.core.testing import BaobabTestCase
from apps.notifications.models import Notification
from apps.storage.backends import FakeBackend
from apps.storage.models import StoredFile


class Base(BaobabTestCase):
    def setUp(self):
        super().setUp()
        FakeBackend.reset()
        self.a, self.b, self.c = verified_user("alice"), verified_user("bob"), verified_user("carol")
        self.ca, self.cb, self.cc, self.anon = api_client(self.a), api_client(self.b), api_client(self.c), api_client()

    def befriend(self, x, y):
        cx, cy = api_client(x), api_client(y)
        rid = cx.post("/api/v1/friends/requests/", {"username": y.username}, format="json").json()["id"]
        assert cy.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json").status_code == 200


class ProfileApiTests(Base):
    def test_me_and_profile_update_with_a_verified_avatar_file(self):
        fid = upload_file(self.ca, "avatar")
        r = self.ca.patch("/api/v1/me/profile/", {"display_name": "Alice B.", "headline": "Dev Django", "country": "CM", "languages": ["fr", "en"], "avatar_file": fid}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual((body["display_name"], body["country"]["code"], body["languages"]), ("Alice B.", "CM", ["fr", "en"]))
        self.assertIn("fake-bucket.invalid/get/avatar/", body["avatar_url"])
        self.assertEqual(self.ca.get("/api/v1/me/").json()["email"], self.a.email)

    def test_replacing_the_avatar_deletes_the_old_object(self):
        f1 = upload_file(self.ca, "avatar")
        self.ca.patch("/api/v1/me/profile/", {"avatar_file": f1}, format="json")
        key1 = StoredFile.objects.get(pk=f1).key
        f2 = upload_file(self.ca, "avatar")
        self.ca.patch("/api/v1/me/profile/", {"avatar_file": f2}, format="json")
        self.assertEqual(StoredFile.objects.get(pk=f1).status, "deleted")
        self.assertNotIn(key1, FakeBackend.objects)
        self.ca.patch("/api/v1/me/profile/", {"avatar_file": None}, format="json")
        self.assertIsNone(self.ca.get("/api/v1/me/").json()["avatar_url"])

    def test_cannot_use_someone_elses_file_or_a_file_of_the_wrong_purpose(self):
        theirs = upload_file(self.cb, "avatar")
        self.assertEqual(self.ca.patch("/api/v1/me/profile/", {"avatar_file": theirs}, format="json").json()["error"]["code"], "invalid_file")  # anti-IDOR
        cv = upload_file(self.ca, "cv", "application/pdf", filename="cv.pdf")
        self.assertEqual(self.ca.patch("/api/v1/me/profile/", {"avatar_file": cv}, format="json").status_code, 422)  # un CV n'est pas un avatar

    def test_profile_privacy_blocking_and_search(self):
        self.assertEqual(self.anon.get("/api/v1/users/alice/").status_code, 200)
        self.ca.patch("/api/v1/me/privacy/", {"profile_visibility": "friends"}, format="json")
        self.assertEqual(self.cb.get("/api/v1/users/alice/").status_code, 404)
        self.assertEqual(self.anon.get("/api/v1/users/alice/").status_code, 404)
        self.assertEqual(self.ca.get("/api/v1/users/alice/").status_code, 200)  # le proprietaire se voit
        self.befriend(self.a, self.b)
        r = self.cb.get("/api/v1/users/alice/")
        self.assertEqual((r.status_code, r.json()["relation"]["is_friend"], r.json()["stats"]["friends"]), (200, True, 1))
        self.assertEqual(self.cc.get("/api/v1/users/alice/").status_code, 404)
        self.ca.patch("/api/v1/me/privacy/", {"profile_visibility": "public"}, format="json")
        self.cb.post("/api/v1/users/alice/block/")
        self.assertEqual(self.ca.get("/api/v1/users/bob/").status_code, 404)  # le blocage joue dans les DEUX sens
        self.assertEqual(self.cb.get("/api/v1/users/alice/").status_code, 404)
        self.assertEqual(self.ca.get("/api/v1/users/", {"q": "bob"}).json(), [])
        self.assertEqual(len(self.cc.get("/api/v1/users/", {"q": "alice"}).json()), 1)
        self.assertEqual(self.anon.get("/api/v1/users/", {"q": "a"}).status_code, 400)  # minimum 2 caracteres
        self.ca.patch("/api/v1/me/privacy/", {"searchable": False}, format="json")
        self.assertEqual(self.cc.get("/api/v1/users/", {"q": "alice"}).json(), [])

    def test_skills_validation_and_account_deletion_needs_the_password(self):
        self.assertEqual(self.ca.put("/api/v1/me/skills/", {"skills": [{"slug": "django", "level": 4}]}, format="json").status_code, 200)
        self.assertEqual(self.ca.put("/api/v1/me/skills/", {"skills": [{"slug": "inexistante", "level": 2}]}, format="json").json()["error"]["code"], "unknown_skill")
        self.assertEqual(self.ca.put("/api/v1/me/skills/", {"skills": [{"slug": "django", "level": 9}]}, format="json").status_code, 400)
        self.assertEqual(self.ca.post("/api/v1/me/delete/", {"password": "mauvais"}, format="json").status_code, 403)
        self.assertEqual(self.ca.post("/api/v1/me/delete/", {"password": "S3cure-pass-phrase!"}, format="json").status_code, 204)
        self.assertEqual(self.anon.get("/api/v1/users/alice/").status_code, 404)

    def test_reference_lists_are_public(self):
        for path in ("skills", "interests", "professions", "countries"):
            r = self.anon.get(f"/api/v1/{path}/")
            self.assertEqual(r.status_code, 200, path)
            self.assertGreater(len(r.json()), 0, path)


class FriendsAndGroupsApiTests(Base):
    def test_friend_flow_and_isolation(self):
        rid = self.ca.post("/api/v1/friends/requests/", {"username": "bob"}, format="json").json()["id"]
        self.assertEqual(len(self.cb.get("/api/v1/friends/requests/").json()), 1)
        self.assertEqual(self.ca.get("/api/v1/friends/requests/").json(), [])
        self.assertEqual(len(self.ca.get("/api/v1/friends/requests/sent/").json()), 1)
        self.assertNotEqual(self.cc.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json").status_code, 200)  # un tiers ne peut pas accepter
        self.assertNotEqual(self.ca.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json").status_code, 200)  # ni l'auteur lui-meme
        self.assertEqual(self.cb.post(f"/api/v1/friends/requests/{rid}/respond/", {"accept": True}, format="json").json()["status"], "accepted")
        self.assertEqual([f["username"] for f in self.ca.get("/api/v1/friends/").json()["results"]], ["bob"])
        self.assertEqual(self.cc.get("/api/v1/friends/").json()["results"], [])
        self.assertEqual(self.ca.post("/api/v1/friends/requests/", {"username": "inconnu"}, format="json").status_code, 404)
        self.assertEqual(self.ca.delete("/api/v1/friends/bob/").status_code, 204)

    def test_follow_block_and_close_friends(self):
        self.assertEqual(self.ca.post("/api/v1/users/bob/follow/").status_code, 201)
        self.assertEqual([u["username"] for u in self.cb.get("/api/v1/me/followers/").json()["results"]], ["alice"])
        self.ca.post("/api/v1/users/bob/block/")
        self.assertEqual(self.cb.get("/api/v1/me/followers/").json()["results"], [])  # le blocage rompt l'abonnement
        self.assertEqual([u["username"] for u in self.ca.get("/api/v1/me/blocks/").json()], ["bob"])
        self.assertEqual(self.ca.delete("/api/v1/users/bob/block/").status_code, 204)

    def test_hidden_group_does_not_exist_for_outsiders_and_private_join_needs_approval(self):
        created = self.ca.post("/api/v1/groups/", {"name": "Secret", "slug": "secret", "privacy": "hidden", "join_policy": "invite_only"}, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(self.cb.get("/api/v1/groups/secret/").status_code, 404)
        self.assertEqual(self.cb.post("/api/v1/groups/secret/join/").status_code, 404)
        self.assertNotIn("secret", [g["slug"] for g in self.cb.get("/api/v1/groups/").json()["results"]])
        self.assertIsNotNone(self.ca.get("/api/v1/groups/secret/").json()["my_role"])  # le proprietaire voit son groupe cache
        self.ca.post("/api/v1/groups/", {"name": "Django CM", "slug": "django-cm", "privacy": "public", "join_policy": "approval"}, format="json")
        self.assertEqual(self.cb.post("/api/v1/groups/django-cm/join/").json()["status"], "pending")
        self.assertEqual(self.cb.get("/api/v1/groups/django-cm/join-requests/").status_code, 403)  # un simple candidat ne voit pas les demandes
        reqs = self.ca.get("/api/v1/groups/django-cm/join-requests/").json()
        self.assertEqual(len(reqs), 1)
        self.assertEqual(self.cc.post(f"/api/v1/group-join-requests/{reqs[0]['id']}/review/", {"approve": True}, format="json").status_code, 403)  # un tiers ne valide pas
        self.assertEqual(self.ca.post(f"/api/v1/group-join-requests/{reqs[0]['id']}/review/", {"approve": True}, format="json").json()["status"], "approved")
        self.assertEqual(self.cb.get("/api/v1/groups/django-cm/").json()["member_count"], 2)

    def test_invite_ban_channels_permissions(self):
        self.ca.post("/api/v1/groups/", {"name": "G", "slug": "g1", "privacy": "private", "join_policy": "invite_only"}, format="json")
        self.assertEqual(self.cb.post("/api/v1/groups/g1/invite/", {"username": "carol"}, format="json").status_code, 403)  # non-membre
        inv = self.ca.post("/api/v1/groups/g1/invite/", {"username": "bob"}, format="json").json()["id"]
        self.assertEqual(len(self.cb.get("/api/v1/me/group-invitations/").json()), 1)
        self.assertNotEqual(self.cc.post(f"/api/v1/group-invitations/{inv}/respond/", {"accept": True}, format="json").status_code, 200)
        self.assertEqual(self.cb.post(f"/api/v1/group-invitations/{inv}/respond/", {"accept": True}, format="json").json()["status"], "accepted")
        self.assertEqual(self.cb.post("/api/v1/groups/g1/channels/", {"name": "General", "slug": "general"}, format="json").status_code, 403)  # simple membre
        self.assertEqual(self.ca.post("/api/v1/groups/g1/channels/", {"name": "General", "slug": "general"}, format="json").status_code, 201)
        self.assertEqual(self.cc.get("/api/v1/groups/g1/channels/").status_code, 404)  # non-membre : le groupe prive ne livre pas ses channels
        self.assertEqual(self.cb.get("/api/v1/groups/g1/members/").status_code, 200)
        self.assertEqual(self.cc.get("/api/v1/groups/g1/members/").status_code, 404)
        self.assertEqual(self.cb.post("/api/v1/groups/g1/ban/", {"username": "alice"}, format="json").status_code, 403)
        self.assertEqual(self.ca.post("/api/v1/groups/g1/ban/", {"username": "bob", "reason": "spam"}, format="json").status_code, 201)


class MessagingApiTests(Base):
    def setUp(self):
        super().setUp()
        self.conv = self.ca.post("/api/v1/conversations/direct/", {"username": "bob"}, format="json").json()["id"]

    def send(self, c, text="salut", **kw):
        return c.post(f"/api/v1/conversations/{self.conv}/messages/", {"body": text, **kw}, format="json")

    def test_conversation_flow_unread_read_and_idempotency(self):
        self.assertEqual(self.send(self.ca, "Bonjour Bob").status_code, 201)
        cid = "11111111-1111-4111-8111-111111111111"
        first, second = self.send(self.ca, "retry", client_msg_id=cid), self.send(self.ca, "retry", client_msg_id=cid)
        self.assertEqual(first.json()["id"], second.json()["id"])  # nouvel essai apres coupure reseau : pas de doublon
        inbox = self.cb.get("/api/v1/conversations/").json()
        self.assertEqual((len(inbox), inbox[0]["unread"], inbox[0]["with"]["username"]), (1, 2, "alice"))
        hist = self.cb.get(f"/api/v1/conversations/{self.conv}/messages/").json()["results"]
        self.assertEqual([m["seq"] for m in hist], [2, 1])
        self.assertEqual(self.cb.post(f"/api/v1/conversations/{self.conv}/read/", {"up_to_seq": 2}, format="json").json()["last_read_seq"], 2)
        self.assertEqual(self.cb.get("/api/v1/conversations/").json()[0]["unread"], 0)

    def test_outsiders_cannot_read_send_mark_read_or_open_threads(self):
        m = self.send(self.ca, "prive").json()
        self.assertEqual(self.cc.get(f"/api/v1/conversations/{self.conv}/messages/").status_code, 404)
        self.assertEqual(self.send(self.cc, "intrus").status_code, 403)
        self.assertEqual(self.cc.post(f"/api/v1/conversations/{self.conv}/read/", {"up_to_seq": 1}, format="json").status_code, 404)
        self.assertEqual(self.cc.get(f"/api/v1/conversations/{self.conv}/messages/{m['id']}/thread/").status_code, 404)
        self.assertEqual(self.cc.get("/api/v1/conversations/").json(), [])
        self.assertEqual(self.cc.patch(f"/api/v1/messages/{m['id']}/", {"body": "pirate"}, format="json").status_code, 403)
        self.assertEqual(self.cb.patch(f"/api/v1/messages/{m['id']}/", {"body": "modifie par bob"}, format="json").status_code, 403)  # seul l'auteur modifie
        self.assertEqual(self.ca.patch(f"/api/v1/messages/{m['id']}/", {"body": "corrige"}, format="json").json()["body"], "corrige")

    def test_attachments_are_signed_only_for_members_and_need_own_files(self):
        fid = upload_file(self.ca, "message_attachment", "application/pdf", filename="spec.pdf")
        m = self.send(self.ca, "voir piece jointe", attachments=[fid]).json()
        self.assertEqual(m["attachments"][0]["filename"], "spec.pdf")
        self.assertIn("fake-bucket.invalid/get/message_attachment/", m["attachments"][0]["url"])
        self.assertEqual(self.cb.get(f"/api/v1/conversations/{self.conv}/messages/").json()["results"][0]["attachments"][0]["filename"], "spec.pdf")
        self.assertEqual(self.send(self.cb, "j'utilise son fichier", attachments=[fid]).json()["error"]["code"], "invalid_file")  # le fichier d'Alice n'est pas a Bob

    def test_reactions_and_group_conversations(self):
        m = self.send(self.ca, "hello").json()
        self.assertTrue(self.cb.post(f"/api/v1/messages/{m['id']}/reactions/", {"emoji": "👍"}, format="json").json()["reacted"])
        self.assertEqual(self.cb.get(f"/api/v1/conversations/{self.conv}/messages/").json()["results"][0]["reactions"], {"👍": 1})
        self.assertEqual(self.cc.post(f"/api/v1/messages/{m['id']}/reactions/", {"emoji": "👍"}, format="json").status_code, 403)
        gid = self.ca.post("/api/v1/conversations/group/", {"usernames": ["bob", "carol"], "title": "Equipe"}, format="json").json()["id"]
        self.assertEqual(self.cc.post(f"/api/v1/conversations/{gid}/messages/", {"body": "present"}, format="json").status_code, 201)


class SocialApiTests(Base):
    def post(self, c, **kw):
        return c.post("/api/v1/posts/", {"kind": "text", "body": "Hello #django", **kw}, format="json")

    def test_visibility_is_enforced_on_every_read_path(self):
        self.befriend(self.a, self.b)
        pub = self.post(self.ca, visibility="public", body="public #django").json()["id"]
        fr = self.post(self.ca, visibility="friends", body="entre amis").json()["id"]
        pr = self.post(self.ca, visibility="private", body="secret").json()["id"]
        self.assertEqual([self.anon.get(f"/api/v1/posts/{p}/").status_code for p in (pub, fr, pr)], [200, 404, 404])
        self.assertEqual([self.cb.get(f"/api/v1/posts/{p}/").status_code for p in (pub, fr, pr)], [200, 200, 404])
        self.assertEqual([self.cc.get(f"/api/v1/posts/{p}/").status_code for p in (pub, fr, pr)], [200, 404, 404])
        self.assertEqual([self.ca.get(f"/api/v1/posts/{p}/").status_code for p in (pub, fr, pr)], [200, 200, 200])
        self.assertEqual(len(self.cc.get("/api/v1/users/alice/posts/").json()["results"]), 1)
        self.assertEqual(len(self.cb.get("/api/v1/users/alice/posts/").json()["results"]), 2)
        self.assertEqual(len(self.cc.get("/api/v1/hashtags/django/posts/").json()["results"]), 1)
        for action in ("reactions", "comments", "save", "share"):  # on n'interagit pas avec ce qu'on ne peut pas voir
            self.assertEqual(self.cc.post(f"/api/v1/posts/{fr}/{action}/", {"type": "like", "body": "x"}, format="json").status_code, 404, action)
        self.assertEqual(self.cb.patch(f"/api/v1/posts/{pub}/", {"body": "vandalisme"}, format="json").status_code, 403)
        self.assertEqual(self.cb.delete(f"/api/v1/posts/{pub}/").status_code, 403)

    def test_post_with_private_media_poll_and_edit_delete(self):
        fid = upload_file(self.ca, "post_media", "image/png", filename="shot.png")
        p = self.post(self.ca, media=[{"file": fid, "alt": "capture"}]).json()
        self.assertEqual((p["media"][0]["kind"], p["media"][0]["alt"]), ("image", "capture"))
        self.assertIn("fake-bucket.invalid/get/post_media/", p["media"][0]["url"])
        bobs = upload_file(self.cb, "post_media", "image/png", filename="b.png")
        self.assertEqual(self.post(self.ca, media=[{"file": bobs}]).json()["error"]["code"], "invalid_file")  # media d'un autre refuse
        poll = self.post(self.ca, kind="poll", body="Quel framework ?", poll={"question": "Lequel ?", "options": ["Django", "Flask"]}).json()
        self.assertEqual(poll["kind"], "poll")
        self.assertEqual(self.post(self.ca, kind="poll", poll={"options": ["a", "b"]}).status_code, 400)  # question manquante : erreur claire, pas de 500
        self.assertEqual(self.post(self.ca, kind="poll", poll={"question": "?", "options": ["seule"]}).status_code, 400)
        self.assertEqual(self.ca.patch(f"/api/v1/posts/{p['id']}/", {"body": "edite"}, format="json").json()["body"], "edite")
        self.assertEqual(self.ca.delete(f"/api/v1/posts/{p['id']}/").status_code, 204)
        self.assertEqual(self.cb.get(f"/api/v1/posts/{p['id']}/").status_code, 404)

    def test_reactions_comments_replies_share_save(self):
        pid = self.post(self.ca).json()["id"]
        self.assertEqual(self.cb.post(f"/api/v1/posts/{pid}/reactions/", {"type": "like"}, format="json").json()["reaction"], "like")
        self.assertEqual(self.cb.get(f"/api/v1/posts/{pid}/").json()["my_reaction"], "like")
        self.assertEqual(self.cb.post(f"/api/v1/posts/{pid}/reactions/", {"type": None}, format="json").json()["reaction"], None)
        c1 = self.cb.post(f"/api/v1/posts/{pid}/comments/", {"body": "Bravo"}, format="json").json()
        r1 = self.cc.post(f"/api/v1/posts/{pid}/comments/", {"body": "Merci", "parent": c1["id"]}, format="json").json()
        self.assertEqual(r1["depth"], 1)
        self.assertEqual(len(self.anon.get(f"/api/v1/posts/{pid}/comments/").json()["results"]), 1)
        self.assertEqual(len(self.anon.get(f"/api/v1/comments/{c1['id']}/replies/").json()["results"]), 1)
        self.assertEqual(self.cc.delete(f"/api/v1/comments/{c1['id']}/").status_code, 403)  # ni auteur ni auteur du post
        self.assertEqual(self.ca.delete(f"/api/v1/comments/{c1['id']}/").status_code, 204)  # l'auteur du post peut
        self.assertEqual(self.cb.post(f"/api/v1/posts/{pid}/share/", {"comment": "a lire"}, format="json").status_code, 201)
        self.assertEqual(self.cb.post(f"/api/v1/posts/{pid}/save/", {}, format="json").status_code, 201)
        self.assertEqual(len(self.cb.get("/api/v1/me/saved/").json()["results"]), 1)
        self.assertEqual(self.cc.get("/api/v1/me/saved/").json()["results"], [])

    def test_feed_contains_friends_posts_with_signed_media_and_hides_blocked_authors(self):
        self.befriend(self.a, self.b)
        fid = upload_file(self.ca, "post_media", "image/png", filename="x.png")
        self.post(self.ca, visibility="friends", body="pour mes amis", media=[{"file": fid}])
        outbox.relay_batch(100)
        feed = self.cb.get("/api/v1/feed/").json()
        self.assertEqual([p["body"] for p in feed["results"]], ["pour mes amis"])
        self.assertIn("fake-bucket.invalid/get/post_media/", feed["results"][0]["media"][0]["url"])
        self.assertEqual(self.cc.get("/api/v1/feed/").json()["results"], [])
        self.cb.post("/api/v1/users/alice/block/")
        self.assertEqual(self.cb.get("/api/v1/feed/").json()["results"], [])

    def test_statuses_respect_visibility_and_media_ownership(self):
        self.befriend(self.a, self.b)
        self.ca.post("/api/v1/statuses/", {"kind": "text", "body": "en ligne", "visibility": "friends"}, format="json")
        self.assertEqual(len(self.cb.get("/api/v1/statuses/").json()), 1)
        self.assertEqual(self.cc.get("/api/v1/statuses/").json(), [])
        sid = self.cb.get("/api/v1/statuses/").json()[0]["id"]
        self.assertEqual(self.cb.post(f"/api/v1/statuses/{sid}/react/", {"emoji": "🔥"}, format="json").status_code, 201)
        self.assertEqual(self.cc.post(f"/api/v1/statuses/{sid}/view/").status_code, 404)
        self.assertEqual(self.cc.post("/api/v1/statuses/", {"kind": "image", "file": upload_file(self.ca, "status_media", "image/png")}, format="json").json()["error"]["code"], "invalid_file")


class NotificationsAndModerationApiTests(Base):
    def test_notifications_are_private_and_critical_ones_cannot_be_disabled(self):
        self.ca.post("/api/v1/friends/requests/", {"username": "bob"}, format="json")
        outbox.relay_batch(100)
        mine = self.cb.get("/api/v1/notifications/").json()["results"]
        self.assertEqual((len(mine), mine[0]["type"], mine[0]["actor"]["username"]), (1, "friend_request", "alice"))
        self.assertEqual(self.cb.get("/api/v1/notifications/unread-count/").json()["unread"], 1)
        self.assertEqual(self.cc.get("/api/v1/notifications/").json()["results"], [])
        self.assertEqual(self.cc.get("/api/v1/notifications/unread-count/").json()["unread"], 0)
        self.cc.post("/api/v1/notifications/read/", {"ids": [mine[0]["id"]]}, format="json")  # l'id d'un autre : sans effet
        self.assertEqual(self.cb.get("/api/v1/notifications/unread-count/").json()["unread"], 1)
        self.assertEqual(self.cb.post("/api/v1/notifications/read/", {}, format="json").json()["marked"], 1)
        self.assertEqual(self.cb.put("/api/v1/notifications/preferences/", {"type": "friend_request", "channel": "email", "enabled": False}, format="json").status_code, 200)
        self.assertEqual(self.cb.put("/api/v1/notifications/preferences/", {"type": "security_alert", "channel": "email", "enabled": False}, format="json").json()["error"]["code"], "critical_notification")
        self.assertEqual(self.cb.put("/api/v1/notifications/preferences/", {"type": "inexistant", "channel": "email", "enabled": True}, format="json").status_code, 422)

    def test_reports_and_staff_only_moderation(self):
        pid = self.ca.post("/api/v1/posts/", {"kind": "text", "body": "contenu douteux"}, format="json").json()["id"]
        self.assertGreater(len(self.anon.get("/api/v1/reports/reasons/").json()), 0)
        r = self.cb.post("/api/v1/reports/", {"target_type": "post", "target_id": pid, "reason": "spam"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.cb.get("/api/v1/admin/moderation/cases/").status_code, 403)
        self.assertEqual(self.anon.get("/api/v1/admin/moderation/cases/").status_code, 401)
        admin = verified_user("modo"); admin.is_staff = True; admin.save()
        cases = api_client(admin).get("/api/v1/admin/moderation/cases/").json()["results"]
        self.assertEqual(len(cases), 1)
        d = api_client(admin).post(f"/api/v1/admin/moderation/cases/{cases[0]['id']}/actions/", {"action": "hide", "reason": "spam avere"}, format="json")
        self.assertEqual(d.status_code, 200, d.content)
        self.assertEqual(self.cc.get(f"/api/v1/posts/{pid}/").status_code, 404)  # contenu masque
        self.assertEqual(self.cb.post(f"/api/v1/admin/moderation/cases/{cases[0]['id']}/actions/", {"action": "hide", "reason": "x"}, format="json").status_code, 403)
