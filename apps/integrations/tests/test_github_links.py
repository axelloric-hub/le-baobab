"""Connexion GitHub (OAuth simule), liens YouTube/LinkedIn/GitHub, blocs de cours, depots du portfolio, liens de profil. Aucun appel reseau reel."""
from unittest import mock

from django.db import connection
from django.test import override_settings

from apps.accounts.models import User
from apps.core import redis as R
from apps.core.api_testing import api_client, verified_user
from apps.core.exceptions import DomainError
from apps.core.testing import BaobabTestCase
from apps.education import services as E
from apps.education.testing import make_course
from apps.integrations import github, links
from apps.integrations.models import ExternalAccount

from cryptography.fernet import Fernet

GH = dict(FIELD_ENCRYPTION_KEY=Fernet.generate_key().decode(), GITHUB_CLIENT_ID="cid", GITHUB_CLIENT_SECRET="secret", GITHUB_REDIRECT_URI="https://r.example/api/v1/auth/github/callback/", GITHUB_LOGIN_FRONTEND_URL="")


class Resp:
    def __init__(self, status=200, data=None):
        self.status_code, self._d = status, data

    def json(self):
        if self._d is None:
            raise ValueError
        return self._d


def fake_github(users=None, emails=None, repos=None, token="tok1"):
    """Remplace github._http : /login/oauth/access_token, /user, /user/emails, /repos/x/y."""
    users, repos = users or {"id": 42, "login": "Ada-Dev", "name": "Ada", "avatar_url": ""}, repos or {}

    def http(method, url, **kw):
        if url == github.TOKEN_URL:
            return Resp(200, {"access_token": token, "scope": "read:user,user:email"} if kw["data"]["code"] == "good" else {"error": "bad_verification_code"})
        if url.endswith("/user"):
            return Resp(200, users)
        if url.endswith("/user/emails"):
            return Resp(200, emails if emails is not None else [{"email": "ada@example.com", "verified": True, "primary": True}])
        key = url.split("/repos/")[-1]
        if key in repos:
            return Resp(*repos[key])
        return Resp(404, {})
    return http


def repo_json(full="ada/proj", private=False, owner_id=42):
    return (200, {"full_name": full, "html_url": f"https://github.com/{full}", "description": "d", "language": "Python", "stargazers_count": 3,
                  "owner": {"id": owner_id, "login": full.split("/")[0]}, "private": private, "fork": False, "archived": False, "pushed_at": None})


@override_settings(**GH)
class GithubLoginTests(BaobabTestCase):
    def start(self):
        url = api_client().get("/api/v1/auth/github/start/").json()["authorize_url"]
        return url.split("state=")[1].split("&")[0]

    def callback(self, state, code="good"):
        return api_client().get(f"/api/v1/auth/github/callback/?code={code}&state={state}")

    def test_full_login_creates_account_and_exchange_gives_jwt_once(self):
        with mock.patch.object(github, "_http", fake_github()):
            r = self.callback(self.start())
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertTrue(body["account_created"])
        u = User.objects.get(email="ada@example.com")
        self.assertFalse(u.has_usable_password())
        self.assertEqual(u.status, "active")
        tok = api_client().post("/api/v1/auth/github/exchange/", {"ticket": body["ticket"]}, format="json")
        self.assertEqual(tok.status_code, 200)
        self.assertIn("access", tok.json())
        self.assertEqual(api_client().post("/api/v1/auth/github/exchange/", {"ticket": body["ticket"]}, format="json").status_code, 422)  # billet a usage unique
        acc = ExternalAccount.objects.get(user=u)
        with connection.cursor() as cur:  # lecture BRUTE (sans dechiffrement Django) : le jeton ne doit jamais etre en clair en base
            cur.execute("SELECT access_token FROM %s WHERE id = %%s" % ExternalAccount._meta.db_table, [acc.pk])
            self.assertNotIn("tok1", cur.fetchone()[0])
        self.assertEqual(ExternalAccount.objects.get(pk=acc.pk).access_token, "tok1")

    def test_second_login_reuses_account(self):
        with mock.patch.object(github, "_http", fake_github()):
            self.callback(self.start())
            r = self.callback(self.start())
        self.assertFalse(r.json()["account_created"])
        self.assertEqual(User.objects.filter(email="ada@example.com").count(), 1)

    def test_state_is_single_use_and_unknown_state_refused(self):
        with mock.patch.object(github, "_http", fake_github()):
            st = self.start()
            self.assertEqual(self.callback(st).status_code, 200)
            self.assertEqual(self.callback(st).status_code, 422)
            self.assertEqual(self.callback("inconnu").status_code, 422)

    def test_bad_code_refused(self):
        with mock.patch.object(github, "_http", fake_github()):
            r = self.callback(self.start(), code="mauvais")
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()["error"]["code"], "github_code_invalid")

    def test_no_automatic_merge_with_existing_email(self):
        existing = verified_user()
        User.objects.filter(pk=existing.pk).update(email="ada@example.com")
        with mock.patch.object(github, "_http", fake_github()):
            r = self.callback(self.start())
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "email_taken_connect_instead")
        self.assertFalse(ExternalAccount.objects.exists())

    def test_unverified_or_noreply_email_refused(self):
        emails = [{"email": "x@example.com", "verified": False, "primary": True}, {"email": "1+ada@users.noreply.github.com", "verified": True, "primary": False}]
        with mock.patch.object(github, "_http", fake_github(emails=emails)):
            r = self.callback(self.start())
        self.assertEqual(r.json()["error"]["code"], "github_email_unverified")
        self.assertFalse(User.objects.filter(email="x@example.com").exists())

    def test_link_to_connected_account_and_conflict_with_other_user(self):
        me, other = verified_user(), verified_user()
        with mock.patch.object(github, "_http", fake_github()):
            st = api_client(me).post("/api/v1/me/integrations/github/connect/").json()["authorize_url"].split("state=")[1].split("&")[0]
            self.assertEqual(self.callback(st).json()["connected"], True)
            st2 = api_client(other).post("/api/v1/me/integrations/github/connect/").json()["authorize_url"].split("state=")[1].split("&")[0]
            r = self.callback(st2)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "github_already_linked")

    def test_disconnect_refused_without_password_then_allowed(self):
        with mock.patch.object(github, "_http", fake_github()):
            tk = self.callback(self.start()).json()["ticket"]
        access = api_client().post("/api/v1/auth/github/exchange/", {"ticket": tk}, format="json").json()["access"]
        c = api_client()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        acc_id = c.get("/api/v1/me/integrations/").json()[0]["id"]
        self.assertEqual(c.delete(f"/api/v1/me/integrations/{acc_id}/").status_code, 409)
        u = User.objects.get(email="ada@example.com")
        u.set_password("Un-Mot-De-Passe-Solide-42")
        u.save()
        self.assertEqual(c.delete(f"/api/v1/me/integrations/{acc_id}/").status_code, 204)

    @override_settings(GITHUB_CLIENT_ID="")
    def test_not_configured_gives_clean_503(self):
        r = api_client().get("/api/v1/auth/github/start/")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["error"]["code"], "github_not_configured")

    def test_frontend_redirect_carries_ticket_not_jwt(self):
        with override_settings(GITHUB_LOGIN_FRONTEND_URL="https://app.example/auth/github"), mock.patch.object(github, "_http", fake_github()):
            r = self.callback(self.start())
        self.assertEqual(r.status_code, 302)
        self.assertIn("ticket=", r["Location"])
        self.assertNotIn("eyJ", r["Location"])


class LinkParsingTests(BaobabTestCase):
    def test_youtube_variants_rebuild_embed_url(self):
        for url in ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=90", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x"):
            d = links.resolve(url)
            self.assertEqual(d["video_id"], "dQw4w9WgXcQ")
            self.assertTrue(d["embed_url"].startswith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"))
        self.assertEqual(links.resolve("https://youtu.be/dQw4w9WgXcQ?t=1m30s")["start_seconds"], 90)

    def test_hostile_links_refused(self):
        for url in ("javascript:alert(1)", "http://user:pw@youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ", "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
                    "https://www.youtube.com/watch?v=<script>", "https://evil.io/in/ada", "ftp://github.com/a/b"):
            with self.assertRaises(DomainError, msg=url):
                links.resolve(url)

    def test_linkedin_and_github(self):
        self.assertEqual(links.resolve("https://fr.linkedin.com/in/ada-dev?trk=x")["canonical_url"], "https://www.linkedin.com/in/ada-dev/")
        self.assertEqual(links.resolve("https://github.com/ada/proj/tree/main/src")["repo"], "proj")
        self.assertEqual(links.resolve("https://github.com/ada")["kind"], "profile")
        with self.assertRaises(DomainError):
            links.resolve_for("linkedin", "https://github.com/ada")


@override_settings(**GH)
class LinkEndpointsTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_course()
        self.tc = api_client(self.k.teacher)
        self.repos = {"ada/proj": repo_json()}

    def block(self, **body):
        return self.tc.post(f"/api/v1/chapters/{self.k.c1.pk}/blocks/", body, format="json")

    def test_youtube_video_block_has_player_url_and_ignores_client_embed(self):
        with mock.patch("apps.integrations.services.requests.get", return_value=Resp(200, {"title": "Cours", "author_name": "Ada"})):
            r = self.block(kind="video", url="https://youtu.be/dQw4w9WgXcQ", payload={"embed_url": "https://evil.io/x"})
        self.assertEqual(r.status_code, 201, r.content)
        b = self.k.c1.blocks.latest("position")
        self.assertEqual(b.payload["embed_url"], "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0")
        self.assertEqual(b.payload["title"], "Cours")

    def test_video_not_found_or_not_embeddable(self):
        for status, code in ((404, "video_not_found"), (401, "video_not_embeddable")):
            with mock.patch("apps.integrations.services.requests.get", return_value=Resp(status, {})):
                        r = self.block(kind="video", url=f"https://youtu.be/{'abcdefghi' + str(status)[:2]}")
            self.assertEqual(r.json()["error"]["code"], code)

    def test_blocked_embedding_proposes_link_alternative_that_works(self):
        with mock.patch("apps.integrations.services.requests.get", return_value=Resp(401, {})):
            r = self.block(kind="video", url="https://youtu.be/abcdefghijk")
        err = r.json()["error"]
        self.assertEqual((r.status_code, err["code"], err["hint"]["suggestion"]), (422, "video_not_embeddable", "add_as_link"))
        alt = err["hint"]["alternative"]
        self.assertEqual(alt, {"kind": "link", "url": "https://www.youtube.com/watch?v=abcdefghijk"})
        ok = self.block(**alt)  # le frontend rejoue la proposition telle quelle
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(self.k.c1.blocks.latest("position").url, alt["url"])

    def test_not_found_has_no_alternative(self):
        with mock.patch("apps.integrations.services.requests.get", return_value=Resp(404, {})):
            err = self.block(kind="video", url="https://youtu.be/abcdefghijl").json()["error"]
        self.assertNotIn("hint", err)

    def test_own_hosted_video_file_works_without_youtube(self):
        from apps.core.api_testing import upload_file

        fid = upload_file(self.tc, purpose="course_content", content_type="video/mp4", size=5000, filename="cours.mp4")
        r = self.block(kind="video", title="Mon cours", file=fid)
        self.assertEqual(r.status_code, 201, r.content)
        content = self.tc.get(f"/api/v1/chapters/{self.k.c1.pk}/content/").json()
        vid = [b for b in content["blocks"] if b["kind"] == "video"][-1]
        self.assertTrue(vid["file_url"])
        self.assertIsNone(vid["url"] or None)

    def test_non_youtube_video_refused(self):
        r = self.block(kind="video", url="https://vimeo.com/123")
        self.assertEqual(r.status_code, 422)

    def test_repository_block_validated_through_github(self):
        with mock.patch.object(github, "_http", fake_github(repos=self.repos)):
            ok = self.block(kind="repository", url="https://github.com/ada/proj")
            self.assertEqual(ok.status_code, 201, ok.content)
            self.assertEqual(self.k.c1.blocks.latest("position").payload["repository"]["full_name"], "ada/proj")
            self.assertEqual(self.block(kind="repository", url="https://github.com/ada/absent").json()["error"]["code"], "repository_not_found")
            self.assertEqual(self.block(kind="repository", url="https://github.com/ada").status_code, 422)  # profil, pas un depot

    def test_private_repo_refused(self):
        with mock.patch.object(github, "_http", fake_github(repos={"ada/secret": repo_json("ada/secret", private=True)})):
            r = self.block(kind="repository", url="https://github.com/ada/secret")
        self.assertEqual(r.json()["error"]["code"], "repository_private")

    def test_resolve_endpoint_requires_login_and_works(self):
        self.assertEqual(api_client().post("/api/v1/media/resolve/", {"url": "https://www.linkedin.com/in/ada"}, format="json").status_code, 401)
        r = self.tc.post("/api/v1/media/resolve/", {"url": "https://www.linkedin.com/in/ada"}, format="json")
        self.assertEqual(r.json()["provider"], "linkedin")

    def test_portfolio_repository_from_url_and_ownership(self):
        u = verified_user()
        c = api_client(u)
        with mock.patch.object(github, "_http", fake_github(repos=self.repos)):
            r = c.post("/api/v1/me/portfolio/repositories/from-url/", {"url": "https://github.com/ada/proj"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertFalse(r.json()["owner_verified"])  # pas de compte GitHub lie : valide, mais propriete non prouvee

    def test_profile_links_checked_by_provider(self):
        c = api_client(verified_user())
        self.assertEqual(c.post("/api/v1/me/links/", {"provider": "linkedin", "url": "https://github.com/ada"}, format="json").status_code, 422)
        self.assertEqual(c.post("/api/v1/me/links/", {"provider": "linkedin", "url": "https://www.linkedin.com/in/ada-dev"}, format="json").status_code, 201)


@override_settings(FIELD_ENCRYPTION_KEY=GH["FIELD_ENCRYPTION_KEY"])
class AnonymizeTests(BaobabTestCase):
    def test_anonymize_deletes_github_account(self):
        from apps.accounts.services import anonymize_user

        u = verified_user()
        acc = ExternalAccount.objects.create(user=u, provider_id="github", external_id="9", handle="x")
        anonymize_user(user=u)
        self.assertFalse(ExternalAccount.objects.filter(pk=acc.pk).exists())
