import time

from django.test import SimpleTestCase

from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.exceptions import ConflictError
from apps.core.testing import reset_stores


class RedisPrimitivesTests(SimpleTestCase):
    def setUp(self):
        reset_stores()

    def test_keys_are_namespaced_and_ttl_defined(self):
        self.assertEqual(K.user_presence("u1"), "baobab:user:u1:presence")
        self.assertEqual(K.rate_limit("login", "1.2.3.4"), "baobab:rate_limit:login:1.2.3.4")
        self.assertTrue(all(v > 0 for k, v in vars(K).items() if k.startswith("TTL_")))

    def test_rate_limit_sliding_window(self):
        results = [R.rate_limit("t", "a", limit=3, window_s=60)[0] for _ in range(5)]
        self.assertEqual(results, [True, True, True, False, False])
        allowed, remaining, retry = R.rate_limit("t", "a", 3, 60)
        self.assertFalse(allowed)
        self.assertGreater(retry, 0)
        self.assertTrue(R.rate_limit("t", "other", 3, 60)[0])  # cles independantes

    def test_rate_limit_window_expires(self):
        self.assertTrue(R.rate_limit("t2", "a", 1, 1)[0])
        self.assertFalse(R.rate_limit("t2", "a", 1, 1)[0])
        time.sleep(1.1)
        self.assertTrue(R.rate_limit("t2", "a", 1, 1)[0])

    def test_lock_is_exclusive_and_released(self):
        with R.distributed_lock("res", 1):
            with self.assertRaises(ConflictError):
                with R.distributed_lock("res", 1):
                    pass
        with R.distributed_lock("res", 1):  # liberable apres sortie
            pass

    def test_lock_release_only_by_owner(self):
        r = R.get_redis()
        key = K.lock("res", 2)
        r.set(key, "someone-else", px=5000)
        self.assertEqual(R._script("lock_release")(keys=[key], args=["not-the-owner"]), 0)
        self.assertEqual(r.get(key), "someone-else")

    def test_capped_incr_enforces_frequency_cap(self):
        key = K.ad_freq("ad1", "u1", "day")
        outcomes = [R.capped_incr(key, cap=2, ttl_s=60)[0] for _ in range(4)]
        self.assertEqual(outcomes, [True, True, False, False])
        self.assertGreater(R.get_redis().ttl(key), 0)

    def test_drain_counter_is_atomic_read_and_reset(self):
        R.incr_counter("post_view", "p1", 3)
        R.incr_counter("post_view", "p1")
        self.assertEqual(R.drain_counter("post_view", "p1"), 4)
        self.assertEqual(R.drain_counter("post_view", "p1"), 0)

    def test_idempotency_script_states(self):
        self.assertEqual(R.idempotency_acquire("pay", "k1", "h1")[0], "acquired")
        self.assertEqual(R.idempotency_acquire("pay", "k1", "h1")[0], "in_progress")
        self.assertEqual(R.idempotency_acquire("pay", "k1", "OTHER")[0], "mismatch")
        R.idempotency_complete("pay", "k1", "h1", {"ok": True, "n": 1})
        self.assertEqual(R.idempotency_acquire("pay", "k1", "h1"), ("done", {"ok": True, "n": 1}))

    def test_presence_and_typing_expire(self):
        R.heartbeat("u9")
        self.assertTrue(R.is_online("u9"))
        R.set_typing("c1", "u9")
        self.assertEqual(R.who_is_typing("c1"), ["u9"])
        R.get_redis().zadd(K.conversation_typing("c1"), {"u9": time.time() - 1})  # simule l'expiration
        self.assertEqual(R.who_is_typing("c1"), [])

    def test_all_keys_written_by_primitives_have_ttl(self):
        R.rate_limit("t3", "a", 5, 30)
        R.heartbeat("u1")
        R.set_typing("c", "u1")
        R.capped_incr(K.ad_freq("a", "u", "d"), 5, 30)
        R.idempotency_acquire("s", "k", "h")
        r = R.get_redis()
        for key in r.scan_iter("baobab:*"):
            self.assertGreater(r.ttl(key), 0, f"{key} sans TTL")
