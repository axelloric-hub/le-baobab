import time

from django.test import override_settings
from rest_framework.test import APIClient

from apps.core.internal import JOBS, sign
from apps.core.testing import BaobabTestCase

SECRET = "s" * 40


@override_settings(INTERNAL_JOB_SECRET=SECRET)
class InternalJobTests(BaobabTestCase):
    def call(self, name="relay-outbox", ts=None, sig=None, method="post"):
        ts = str(int(time.time())) if ts is None else ts
        headers = {"HTTP_X_INTERNAL_TIMESTAMP": ts, "HTTP_X_INTERNAL_SIGNATURE": sign(SECRET, ts, name) if sig is None else sig}
        return getattr(APIClient(), method)(f"/internal/jobs/{name}/", **headers)

    def test_valid_signature_runs_every_declared_job(self):
        for name in JOBS:
            r = self.call(name)
            self.assertEqual((r.status_code, r.json()["job"]), (200, name), name)

    def test_rejects_bad_signature_wrong_job_stale_timestamp_and_missing_headers(self):
        self.assertEqual(self.call(sig="0" * 64).status_code, 403)
        ts = str(int(time.time()))
        self.assertEqual(self.call("housekeeping", ts=ts, sig=sign(SECRET, ts, "relay-outbox")).status_code, 403)  # signature d'un autre job
        old = str(int(time.time()) - 3600)
        self.assertEqual(self.call(ts=old, sig=sign(SECRET, old, "relay-outbox")).status_code, 403)  # rejeu
        self.assertEqual(APIClient().post("/internal/jobs/relay-outbox/").status_code, 403)
        self.assertEqual(self.call(ts="abc", sig="x").status_code, 403)

    def test_unknown_job_is_404_only_when_authentic_and_get_is_not_allowed(self):
        self.assertEqual(self.call("rm-rf").status_code, 404)
        self.assertEqual(self.call(method="get").status_code, 405)

    @override_settings(INTERNAL_JOB_SECRET="")
    def test_unconfigured_secret_denies_everything(self):
        ts = str(int(time.time()))
        r = APIClient().post("/internal/jobs/relay-outbox/", HTTP_X_INTERNAL_TIMESTAMP=ts, HTTP_X_INTERNAL_SIGNATURE=sign("", ts, "relay-outbox"))
        self.assertEqual(r.status_code, 403)
