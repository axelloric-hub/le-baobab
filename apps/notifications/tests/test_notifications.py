from django.db import IntegrityError, transaction

from apps.core import outbox
from apps.core.redis import get_redis
from apps.core import redis_keys as K
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.friends import services as F
from apps.notifications import services as N
from apps.notifications.models import Notification, NotificationDelivery, NotificationPreference
from apps.social import services as P


class NotificationTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b = make_user(), make_user()

    def test_notify_creates_in_app_and_per_channel_deliveries(self):
        n = N.notify(recipient=self.b, type_code="friend_request", actor=self.a, data={"from": "a"})
        self.assertEqual(set(n.deliveries.values_list("channel", flat=True)), {"websocket", "push"})

    def test_no_self_notification_and_blocked_actor_is_silent(self):
        self.assertIsNone(N.notify(recipient=self.a, type_code="comment", actor=self.a))
        F.block_user(self.b, self.a)
        self.assertIsNone(N.notify(recipient=self.b, type_code="comment", actor=self.a))

    def test_dedupe_key_prevents_duplicates(self):
        N.notify(recipient=self.b, type_code="post_reaction", actor=self.a, dedupe_key="k1")
        self.assertIsNone(N.notify(recipient=self.b, type_code="post_reaction", actor=self.a, dedupe_key="k1"))
        self.assertEqual(Notification.objects.count(), 1)

    def test_preferences_specific_overrides_general_and_critical_ignores_them(self):
        NotificationPreference.objects.create(user=self.b, type=None, channel="in_app", enabled=False)
        self.assertIsNone(N.notify(recipient=self.b, type_code="comment", actor=self.a))
        NotificationPreference.objects.create(user=self.b, type_id="comment", channel="in_app", enabled=True)
        self.assertIsNotNone(N.notify(recipient=self.b, type_code="comment", actor=self.a))
        self.assertIsNotNone(N.notify(recipient=self.b, type_code="security_alert"))  # critique : non desactivable

    def test_disabled_channel_marks_delivery_skipped(self):
        NotificationPreference.objects.create(user=self.b, type_id="friend_request", channel="push", enabled=False)
        n = N.notify(recipient=self.b, type_code="friend_request", actor=self.a)
        self.assertEqual(n.deliveries.get(channel="push").status, NotificationDelivery.Status.SKIPPED)
        self.assertEqual(n.deliveries.get(channel="websocket").status, NotificationDelivery.Status.PENDING)

    def test_preference_uniqueness_treats_null_type_as_equal(self):
        NotificationPreference.objects.create(user=self.b, type=None, channel="email", enabled=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            NotificationPreference.objects.create(user=self.b, type=None, channel="email", enabled=False)

    def test_unread_counter_rebuilds_from_postgres_and_mark_read(self):
        for i in range(3):
            N.notify(recipient=self.b, type_code="comment", actor=self.a, dedupe_key=f"c{i}")
        get_redis().flushdb()
        self.assertEqual(N.unread_count(self.b.pk), 3)  # reconstruit
        first = Notification.objects.filter(recipient=self.b).first()
        with self.captureOnCommitCallbacks(execute=True):  # l'invalidation du cache part APRES commit
            self.assertEqual(N.mark_read(self.b, [first.pk]), 1)
        self.assertEqual(N.mark_read(self.b, [first.pk]), 0)
        self.assertEqual(N.unread_count(self.b.pk), 2)
        self.assertEqual(N.mark_read(self.b), 2)

    def test_domain_events_become_notifications_idempotently(self):
        f = F.send_friend_request(self.a, self.b)
        p = P.create_post(author=self.b, body="hi")
        P.react_to_post(p.pk, self.a, "like")
        P.add_comment(p.pk, self.a, "nice")
        outbox.relay_batch(100)
        self.assertEqual(set(Notification.objects.filter(recipient=self.b).values_list("type_id", flat=True)), {"friend_request", "post_reaction", "comment"})
        before = Notification.objects.count()
        from apps.core.models import OutboxEvent
        OutboxEvent.objects.update(status="pending")  # rejeu at-least-once
        outbox.relay_batch(100)
        self.assertEqual(Notification.objects.count(), before)


class NotificationRealtimeTests(BaobabTransactionTestCase):
    def test_realtime_counter_incremented_after_commit(self):
        a, b = make_user(), make_user()
        N.notify(recipient=b, type_code="comment", actor=a)
        self.assertEqual(get_redis().get(K.user_notifications_unread(b.pk)), "1")
