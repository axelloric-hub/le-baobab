from datetime import timedelta

from django.test import SimpleTestCase
from django.utils import timezone

from apps.analytics import pipelines as P
from apps.core.mongo import collection, ensure_schema, load_collection_specs
from apps.core.testing import reset_stores


class MongoSchemaTests(SimpleTestCase):
    def setUp(self):
        reset_stores()

    def test_specs_are_well_formed(self):
        specs = load_collection_specs()
        self.assertEqual({s["name"] for s in specs}, {"post_cards", "events", "api_request_logs", "ad_events"})
        for s in specs:
            for key in ("purpose", "read_pattern", "write_pattern", "sharding_future", "ttl", "indexes", "jsonSchema"):
                self.assertIn(key, s, f"{s['name']} sans {key}")
            for idx in s["indexes"]:
                self.assertTrue(idx.get("why"), f"index {idx['name']} sans justification de read pattern")

    def test_ensure_schema_is_idempotent_and_creates_indexes(self):
        first = ensure_schema()
        second = ensure_schema()
        self.assertEqual(first["collections_created"], 4)
        self.assertEqual(second["collections_created"], 0)
        names = {i["name"] for i in collection("events").list_indexes()}
        self.assertTrue({"ttl_expires", "type_ts", "actor_ts", "target_ts"} <= names)
        ttl = next(i for i in collection("events").list_indexes() if i["name"] == "ttl_expires")
        self.assertEqual(ttl["expireAfterSeconds"], 0)


class PipelineTests(SimpleTestCase):
    def setUp(self):
        reset_stores()
        now = timezone.now()
        card = lambda i, tags, r, c, auth: {"_id": f"p{i}", "author": {"id": auth, "username": auth}, "kind": "text", "visibility": "public",
                                            "hashtags": tags, "counters": {"reactions": r, "comments": c, "shares": 0}, "published_at": now - timedelta(hours=i)}
        collection("post_cards").insert_many([card(1, ["django", "python"], 5, 1, "a"), card(2, ["django"], 1, 0, "b"), card(3, ["rust"], 9, 9, "a"),
                                              {**card(4, ["django"], 100, 0, "c"), "visibility": "private"}])
        self.since = now - timedelta(days=1)

    def test_trending_hashtags_ignores_private_and_ranks(self):
        out = P.run("post_cards", P.trending_hashtags(self.since))
        self.assertEqual(out[0]["tag"], "django")
        self.assertEqual((out[0]["posts"], out[0]["reactions"], out[0]["authors"]), (2, 6, 2))
        self.assertNotIn(100, [o["reactions"] for o in out])

    def test_top_posts_use_weighted_engagement(self):
        out = P.run("post_cards", P.top_posts_by_engagement(self.since, limit=1))
        self.assertEqual(out[0]["_id"], "p3")  # 9 + 3*9

    def test_dau_counts_distinct_actors_per_day(self):
        now = timezone.now()
        collection("events").insert_many([
            {"type": "post_created", "actor": {"id": "u1"}, "ts": now}, {"type": "post_liked", "actor": {"id": "u1"}, "ts": now},
            {"type": "post_liked", "actor": {"id": "u2"}, "ts": now}, {"type": "post_viewed", "actor": None, "ts": now}])
        out = P.run("events", P.daily_active_actors(now - timedelta(days=1)))
        self.assertEqual(out[0]["active_users"], 2)
        counts = P.run("events", P.daily_event_counts("post_liked", now - timedelta(days=1)))
        self.assertEqual(counts[0]["count"], 2)
