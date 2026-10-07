from datetime import date, timedelta

from django.core.management import call_command
from django.db import connection
from django.utils import timezone

from apps.analytics.events import track
from apps.analytics.models import DailyMetric
from apps.core import outbox
from apps.core.mongo import collection
from apps.core.testing import BaobabTestCase, make_user
from apps.friends import services as F
from apps.messaging import services as M
from apps.social import services as P


class AnalyticsTests(BaobabTestCase):
    def test_track_validates_against_catalogue_and_is_idempotent(self):
        u = make_user()
        self.assertFalse(track("unknown_event", actor_id=u.pk))
        with self.assertRaises(ValueError):
            track("post_created")  # acteur requis
        for _ in range(2):
            self.assertTrue(track("post_created", actor_id=u.pk, event_id="evt-1"))
        self.assertEqual(collection("events").count_documents({}), 1)
        self.assertTrue(track("post_viewed", target_type="post", target_id="p"))  # anonyme autorise
        doc = collection("events").find_one({"type": "post_viewed"})
        self.assertGreater(doc["expires_at"], doc["ts"])

    def test_domain_events_flow_to_mongo_exactly_once_even_on_replay(self):
        a, b = make_user(), make_user()
        P.create_post(author=a, body="hi")
        F.respond_to_request(F.send_friend_request(a, b).pk, b, True)
        conv, _ = M.get_or_create_direct(a, b); M.send_message(conversation_id=conv.pk, sender=a, body="yo")
        self.assertEqual(outbox.relay_batch(100)["failed"], 0)
        types = sorted(collection("events").distinct("type"))
        self.assertEqual(types, ["friendship_created", "message_sent", "post_created", "user_registered"])
        n = collection("events").count_documents({})
        from apps.core.models import OutboxEvent
        OutboxEvent.objects.update(status="pending"); outbox.relay_batch(100)
        self.assertEqual(collection("events").count_documents({}), n)

    def test_daily_metrics_function_is_idempotent_upsert(self):
        a, b = make_user(), make_user()
        P.create_post(author=a, body="1"); P.create_post(author=a, body="2")
        conv, _ = M.get_or_create_direct(a, b); M.send_message(conversation_id=conv.pk, sender=a, body="m")
        for _ in range(2):
            call_command("refresh_metrics", days=1, verbosity=0)
        m = {x.metric: float(x.value) for x in DailyMetric.objects.filter(day=timezone.now().date())}
        self.assertEqual((m["new_users"], m["posts"], m["messages"], m["active_posters"]), (2, 2, 1, 1))
        self.assertEqual(DailyMetric.objects.filter(metric="posts").count(), 1)

    def test_materialized_views_refresh_concurrently_and_housekeeping_runs(self):
        a = make_user(); P.create_post(author=a, body="#trend one"); P.create_post(author=a, body="#trend two")
        call_command("refresh_materialized_views", verbosity=0)
        with connection.cursor() as cur:
            cur.execute("SELECT tag, posts_7d FROM mv_trending_hashtags")
            self.assertEqual(cur.fetchall(), [("trend", 2)])
            cur.execute("SELECT new_users FROM mv_platform_daily WHERE day = current_date")
            self.assertEqual(cur.fetchone()[0], 1)
            cur.execute("SELECT * FROM v_user_statistics WHERE user_id = %s", [a.pk])
            self.assertEqual(cur.fetchone()[1], 2)
        call_command("housekeeping", verbosity=0)
