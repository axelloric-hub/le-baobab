from django.test import override_settings

from apps.core.api_testing import api_client, verified_user
from apps.core.testing import BaobabTestCase
from apps.storage import services as F
from apps.storage.backends import FakeBackend, S3Backend
from apps.storage.models import StoredFile


class UploadFlowTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        FakeBackend.reset()
        self.a, self.b = verified_user(), verified_user()
        self.ca, self.cb = api_client(self.a), api_client(self.b)

    def ask(self, c, **kw):
        body = {"purpose": "avatar", "filename": "moi.png", "content_type": "image/png", "size_bytes": 1000, **kw}
        return c.post("/api/v1/files/uploads/", body, format="json")

    def test_the_client_never_chooses_the_key_and_it_is_namespaced_by_owner(self):
        r = self.ask(self.ca, filename="../../etc/passwd")
        self.assertEqual(r.status_code, 201)
        f = StoredFile.objects.get(pk=r.json()["file_id"])
        self.assertTrue(f.key.startswith(f"avatar/{self.a.pk}/"))
        self.assertNotIn("..", f.key)
        self.assertEqual(f.filename, "passwd")
        self.assertEqual((r.json()["method"], r.json()["headers"]["Content-Type"]), ("PUT", "image/png"))
        self.assertIn(f.key, r.json()["url"])
        self.assertEqual(f.status, "pending")

    def test_type_size_and_purpose_are_validated(self):
        self.assertEqual(self.ask(self.ca, content_type="image/svg+xml").json()["error"]["code"], "invalid_content_type")  # SVG : XSS par fichier
        self.assertEqual(self.ask(self.ca, content_type="text/html").status_code, 422)
        self.assertEqual(self.ask(self.ca, size_bytes=6 * 1024 * 1024).json()["error"]["code"], "invalid_size")
        self.assertEqual(self.ask(self.ca, size_bytes=0).status_code, 400)
        self.assertEqual(self.ask(self.ca, purpose="inconnu").status_code, 400)
        self.assertEqual(self.ca.post("/api/v1/files/uploads/", {"purpose": "cv", "filename": "x.exe", "content_type": "application/x-msdownload", "size_bytes": 10}, format="json").status_code, 422)

    @override_settings(USER_STORAGE_QUOTA_BYTES=2500)
    def test_per_user_quota(self):
        self.assertEqual(self.ask(self.ca).status_code, 201)
        self.assertEqual(self.ask(self.ca).status_code, 201)
        self.assertEqual(self.ask(self.ca).json()["error"]["code"], "quota_exceeded")
        self.assertEqual(self.ask(self.cb).status_code, 201)  # le quota est PAR utilisateur

    def test_completion_verifies_the_bucket_instead_of_trusting_the_client(self):
        up = self.ask(self.ca).json()
        key = StoredFile.objects.get(pk=up["file_id"]).key
        r = self.ca.post(f"/api/v1/files/{up['file_id']}/complete/")
        self.assertEqual(r.json()["error"]["code"], "upload_missing")  # rien dans le bucket : refuse
        FakeBackend.simulate_upload(key, 1000, "image/png")
        ok = self.ca.post(f"/api/v1/files/{up['file_id']}/complete/")
        self.assertEqual((ok.status_code, ok.json()["status"]), (200, "uploaded"))
        self.assertEqual(self.ca.post(f"/api/v1/files/{up['file_id']}/complete/").status_code, 200)  # idempotent

    def test_mismatching_upload_is_destroyed(self):
        up = self.ask(self.ca).json()
        key = StoredFile.objects.get(pk=up["file_id"]).key
        FakeBackend.simulate_upload(key, 999_999, "image/png")  # taille differente de celle autorisee
        r = self.ca.post(f"/api/v1/files/{up['file_id']}/complete/")
        self.assertEqual(r.json()["error"]["code"], "upload_mismatch")
        self.assertEqual(StoredFile.objects.get(pk=up["file_id"]).status, "deleted")
        self.assertNotIn(key, FakeBackend.objects)

    def test_other_accounts_cannot_complete_read_list_or_delete_my_files(self):
        up = self.ask(self.ca, purpose="cv", content_type="application/pdf", filename="cv.pdf").json()
        fid = up["file_id"]
        FakeBackend.simulate_upload(StoredFile.objects.get(pk=fid).key, 1000, "application/pdf")
        self.ca.post(f"/api/v1/files/{fid}/complete/")
        self.assertEqual(self.cb.post(f"/api/v1/files/{fid}/complete/").status_code, 404)
        self.assertEqual(self.cb.get(f"/api/v1/files/{fid}/url/").status_code, 404)  # 404 et non 403 : on ne revele pas l'existence
        self.assertEqual(self.cb.delete(f"/api/v1/files/{fid}/").status_code, 404)
        self.assertEqual(self.cb.get("/api/v1/files/").json()["results"], [])
        self.assertEqual(len(self.ca.get("/api/v1/files/").json()["results"]), 1)
        self.assertEqual(api_client().get(f"/api/v1/files/{fid}/url/").status_code, 404)  # anonyme non plus
        self.assertEqual(self.ca.get(f"/api/v1/files/{fid}/url/").status_code, 200)

    def test_public_purposes_are_readable_by_anyone_private_ones_only_by_the_owner(self):
        up = self.ask(self.ca).json()  # avatar = public
        FakeBackend.simulate_upload(StoredFile.objects.get(pk=up["file_id"]).key, 1000, "image/png")
        self.ca.post(f"/api/v1/files/{up['file_id']}/complete/")
        self.assertEqual(api_client().get(f"/api/v1/files/{up['file_id']}/url/").status_code, 200)
        self.assertEqual(self.cb.get(f"/api/v1/files/{up['file_id']}/url/").status_code, 200)

    def test_pending_files_are_not_downloadable_and_deleted_ones_disappear(self):
        up = self.ask(self.ca).json()
        self.assertEqual(self.ca.get(f"/api/v1/files/{up['file_id']}/url/").status_code, 404)  # pas encore verifie
        key = StoredFile.objects.get(pk=up["file_id"]).key
        FakeBackend.simulate_upload(key, 1000, "image/png")
        self.ca.post(f"/api/v1/files/{up['file_id']}/complete/")
        self.assertEqual(self.ca.delete(f"/api/v1/files/{up['file_id']}/").status_code, 204)
        self.assertNotIn(key, FakeBackend.objects)
        self.assertEqual(self.ca.get(f"/api/v1/files/{up['file_id']}/url/").status_code, 404)

    def test_resolve_owned_blocks_references_to_someone_elses_file(self):
        """Quand un avatar/CV/media est reference dans une autre ressource, seul un fichier A SOI, ENVOYE et du BON USAGE est accepte (anti-IDOR)."""
        from apps.core.exceptions import DomainError
        up = self.ask(self.ca).json()
        FakeBackend.simulate_upload(StoredFile.objects.get(pk=up["file_id"]).key, 1000, "image/png")
        self.ca.post(f"/api/v1/files/{up['file_id']}/complete/")
        self.assertEqual(F.resolve_owned(self.a, up["file_id"], ("avatar",)).owner_id, self.a.pk)
        for user, purposes in ((self.b, ("avatar",)), (self.a, ("cv",))):
            with self.assertRaises(DomainError):
                F.resolve_owned(user, up["file_id"], purposes)

    @override_settings(STORAGE_FAKE_AUTO_COMPLETE=True)
    def test_fake_auto_complete_for_trials_without_a_bucket(self):
        up = self.ask(self.ca).json()
        self.assertEqual(self.ca.post(f"/api/v1/files/{up['file_id']}/complete/").json()["status"], "uploaded")

    def test_purposes_endpoint_is_public(self):
        r = api_client().get("/api/v1/files/purposes/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("product_asset", {p["purpose"] for p in r.json()})


class S3PresignTests(BaobabTestCase):
    """Signature SANS reseau : on verifie que l'URL produite est bien signee et lie le type et la taille."""

    @override_settings(STORAGE_BACKEND="s3", STORAGE_ENDPOINT_URL="https://abc123.r2.cloudflarestorage.com", STORAGE_BUCKET="baobab", STORAGE_ACCESS_KEY_ID="AKIATEST",
                       STORAGE_SECRET_ACCESS_KEY="secret-test", STORAGE_REGION="auto")
    def test_presigned_put_binds_content_type_and_length_and_expires(self):
        b = S3Backend()
        url, headers = b.presign_put("avatar/u/1/moi.png", "image/png", 1234, 900)
        self.assertTrue(url.startswith("https://abc123.r2.cloudflarestorage.com/baobab/avatar/u/1/moi.png?"))
        for part in ("X-Amz-Signature=", "X-Amz-Expires=900", "X-Amz-Algorithm=AWS4-HMAC-SHA256"):
            self.assertIn(part, url)
        self.assertIn("content-length", url.lower())          # la taille declaree fait partie de la signature
        self.assertEqual(headers, {"Content-Type": "image/png"})
        get = b.presign_get("avatar/u/1/moi.png", 300, "moi.png")
        self.assertIn("X-Amz-Expires=300", get)
        self.assertNotIn("secret-test", url + get)            # le secret ne fuit jamais dans l'URL
