from channels.testing import WebsocketCommunicator
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from apps.core import scheduler as S
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, reset_stores


class SchedulerTests(SimpleTestCase):
    def test_jobs_run_only_when_due_and_errors_do_not_stop_others(self):
        calls, last = [], {}
        jobs = [S.Job("a", 10, lambda: calls.append("a")), S.Job("boom", 10, lambda: 1 / 0), S.Job("b", 100, lambda: calls.append("b"))]
        self.assertEqual(S.run_due(jobs, last, 0, claim=lambda j: True), ["a", "b"])  # "boom" echoue sans bloquer
        self.assertEqual(S.run_due(jobs, last, 5, claim=lambda j: True), [])           # rien n'est echu
        self.assertEqual(S.run_due(jobs, last, 10, claim=lambda j: True), ["a"])       # a et boom echus ; b non
        self.assertEqual(calls, ["a", "b", "a"])

    def test_unclaimed_job_is_skipped_but_rescheduled(self):
        calls, last = [], {}
        job = S.Job("only-one-worker", 10, lambda: calls.append(1))
        self.assertEqual(S.run_due([job], last, 0, claim=lambda j: False), [])
        self.assertEqual(calls, [])
        self.assertEqual(S.run_due([job], last, 3, claim=lambda j: True), [])  # pas de rattrapage immediat : meme intervalle

    def test_redis_claim_is_exclusive_per_interval_and_relay_is_never_gated(self):
        reset_stores()
        job = S.Job("x", 30, lambda: None)
        self.assertEqual((S.redis_claim(job), S.redis_claim(job)), (True, False))
        relay = S.Job("relay", 3, lambda: None, singleton=False)
        self.assertEqual((S.redis_claim(relay), S.redis_claim(relay)), (True, True))

    def test_default_jobs_are_declared_and_runnable_names(self):
        names = [j.name for j in S.default_jobs()]
        self.assertEqual(names, ["relay-outbox", "flush-counters", "refresh-trending", "refresh-platform", "refresh-metrics", "housekeeping", "ads-settle", "ads-recover", "storage-cleanup", "expire-orders"])
        self.assertFalse(S.default_jobs()[0].singleton)

    def test_background_thread_starts_once(self):
        S._started.clear()
        original = S._loop
        S._loop = lambda: None  # ne lance pas la vraie boucle en test
        try:
            self.assertTrue(S.start_in_background())
            self.assertFalse(S.start_in_background())
        finally:
            S._loop = original
            S._started.clear()


class EdgeSecretTests(BaobabTestCase):
    @override_settings(EDGE_SHARED_SECRET="e" * 40)
    def test_direct_access_is_refused_but_edge_health_and_jobs_are_reachable(self):
        c = APIClient()
        self.assertEqual(c.get("/ready/").status_code, 403)
        self.assertEqual(c.get("/ready/", HTTP_X_EDGE_SECRET="wrong").status_code, 403)
        self.assertIn(c.get("/ready/", HTTP_X_EDGE_SECRET="e" * 40).status_code, (200, 503))  # autorise (503 = base absente)
        self.assertEqual(c.get("/health/").status_code, 200)                                   # sonde de l'hebergeur
        self.assertEqual(c.post("/internal/jobs/housekeeping/").status_code, 403)              # refuse par SA signature, pas par l'edge

    def test_disabled_when_secret_empty(self):
        self.assertIn(APIClient().get("/ready/").status_code, (200, 503))


class EdgeSecretWebSocketTests(BaobabTransactionTestCase):
    def test_websocket_requires_edge_secret(self):
        from asgiref.sync import async_to_sync
        from apps.core.ws_auth import EdgeSecretASGIMiddleware

        async def inner(scope, receive, send):
            await send({"type": "websocket.accept"})

        async def scenario():
            app = EdgeSecretASGIMiddleware(inner)
            refused = WebsocketCommunicator(app, "/ws/x/")
            r1, code = await refused.connect()
            ok = WebsocketCommunicator(app, "/ws/x/", headers=[(b"x-edge-secret", b"e" * 40)])
            r2, _ = await ok.connect()
            await ok.disconnect()
            return r1, code, r2

        with override_settings(EDGE_SHARED_SECRET="e" * 40):
            refused, code, accepted = async_to_sync(scenario)()
        self.assertEqual((refused, code, accepted), (False, 4403, True))
