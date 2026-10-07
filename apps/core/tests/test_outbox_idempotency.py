from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.core import outbox
from apps.core.exceptions import ConflictError, IdempotencyConflictError
from apps.core.idempotency import run_idempotent
from apps.core.models import IdempotencyRecord, OutboxEvent
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase


class OutboxTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self._saved = dict(outbox._HANDLERS)
        outbox._HANDLERS.clear()
        self.addCleanup(lambda: (outbox._HANDLERS.clear(), outbox._HANDLERS.update(self._saved)))

    def test_event_written_in_same_transaction_and_rolled_back_with_it(self):
        try:
            with transaction.atomic():
                outbox.publish_event("X", "t", 1, {"a": 1})
                raise ValueError
        except ValueError:
            pass
        self.assertEqual(OutboxEvent.objects.count(), 0)

    def test_relay_delivers_once_and_marks_processed(self):
        seen = []
        outbox.subscribe("Ping")(lambda ev: seen.append(ev.payload))
        with transaction.atomic():
            outbox.publish_event("Ping", "t", 7, {"n": 1})
        self.assertEqual(outbox.relay_batch()["processed"], 1)
        self.assertEqual(outbox.relay_batch()["processed"], 0)
        self.assertEqual(seen, [{"n": 1}])
        self.assertEqual(OutboxEvent.objects.get().status, "processed")

    def test_failing_handler_is_retried_with_backoff_then_failed(self):
        def boom(ev):
            raise RuntimeError("down")

        outbox.subscribe("Boom")(boom)
        with transaction.atomic():
            ev = outbox.publish_event("Boom", "t", 1)
        stats = outbox.relay_batch()
        ev.refresh_from_db()
        self.assertEqual((stats["retried"], ev.status, ev.attempts), (1, "pending", 1))
        self.assertGreater(ev.available_at, timezone.now())
        self.assertEqual(outbox.relay_batch()["retried"], 0)  # pas encore echu
        OutboxEvent.objects.update(attempts=outbox.MAX_ATTEMPTS - 1, available_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(outbox.relay_batch()["failed"], 1)
        self.assertEqual(OutboxEvent.objects.get().status, "failed")


class IdempotencyTests(BaobabTestCase):
    def test_operation_runs_once_and_response_is_replayed(self):
        calls = []

        def op():
            calls.append(1)
            return {"order": "o1"}

        a = run_idempotent("order.create", "key-1", {"cart": 1}, op)
        b = run_idempotent("order.create", "key-1", {"cart": 1}, op)
        self.assertEqual((a, b, len(calls)), ({"order": "o1"}, {"order": "o1"}, 1))
        self.assertEqual(IdempotencyRecord.objects.get().status, "completed")

    def test_replay_survives_redis_loss(self):
        run_idempotent("pay", "k", {"a": 1}, lambda: {"paid": True})
        from apps.core.redis import get_redis

        get_redis().flushdb()  # eviction / failover : la verite est en base
        calls = []
        self.assertEqual(run_idempotent("pay", "k", {"a": 1}, lambda: calls.append(1) or {"paid": False}), {"paid": True})
        self.assertEqual(calls, [])

    def test_same_key_different_payload_is_rejected(self):
        run_idempotent("pay", "k", {"amount": 10}, lambda: {"ok": 1})
        with self.assertRaises(IdempotencyConflictError):
            run_idempotent("pay", "k", {"amount": 99}, lambda: {"ok": 2})

    def test_failed_operation_releases_key_and_leaves_no_record(self):
        def bad():
            raise ValueError("nope")

        with self.assertRaises(ValueError):
            run_idempotent("pay", "k2", {"a": 1}, bad)
        self.assertEqual(IdempotencyRecord.objects.count(), 0)
        self.assertEqual(run_idempotent("pay", "k2", {"a": 1}, lambda: {"ok": 1}), {"ok": 1})  # reessayable

    def test_in_progress_is_conflict(self):
        from apps.core.redis import idempotency_acquire

        idempotency_acquire("pay", "k3", __import__("apps.core.idempotency", fromlist=["x"]).hash_request({"a": 1}))
        with self.assertRaises(ConflictError):
            run_idempotent("pay", "k3", {"a": 1}, lambda: {})


class OutboxGuardTests(BaobabTransactionTestCase):
    """TestCase enveloppe tout dans une transaction : la garde ne se teste qu'en vraie transaction."""

    def test_publish_requires_transaction(self):
        with self.assertRaises(RuntimeError):
            outbox.publish_event("X", "t", 1)
