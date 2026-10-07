import math
from datetime import timedelta

from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.community import services as C
from apps.core import outbox
from apps.core.choices import Visibility as V
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.mongo import collection
from apps.core.redis import get_redis
from apps.core import redis_keys as K
from apps.core.testing import BaobabTestCase, make_user
from apps.friends import services as F
from apps.social import feed, selectors as S, services as P
from apps.social.models import Comment, Hashtag, Post, PollOption, Status


def befriend(a, b):
    F.respond_to_request(F.send_friend_request(a, b).pk, b, True)


class VisibilityMatrixTests(BaobabTestCase):
    """Chaque visibilite x chaque type de spectateur : la confidentialite est le coeur du risque."""

    def setUp(self):
        super().setUp()
        self.author, self.friend, self.close, self.follower, self.stranger, self.member, self.audience = (make_user() for _ in range(7))
        befriend(self.author, self.friend); befriend(self.author, self.close)
        F.add_close_friend(self.author, self.close)
        F.follow(self.follower, self.author)
        self.group = C.create_group(owner=self.author, name="G", slug="g", privacy="private")
        C.join_group  # noqa
        from apps.community.models import GroupMember
        GroupMember.objects.create(group=self.group, user=self.member, role=self.group.roles.get(is_default=True))

    def post(self, vis, **kw):
        return P.create_post(author=self.author, body="x", visibility=vis, **kw)

    def visible_to(self, post):
        return {name for name, u in {"author": self.author, "friend": self.friend, "close": self.close, "follower": self.follower,
                                      "stranger": self.stranger, "member": self.member, "audience": self.audience}.items()
                if S.can_view_post(u.pk, post.pk)} | ({"anon"} if S.visible_posts(None).filter(pk=post.pk).exists() else set())

    def test_matrix(self):
        everyone = {"author", "friend", "close", "follower", "stranger", "member", "audience", "anon"}
        self.assertEqual(self.visible_to(self.post(V.PUBLIC)), everyone)
        self.assertEqual(self.visible_to(self.post(V.FRIENDS)), {"author", "friend", "close"})
        self.assertEqual(self.visible_to(self.post(V.CLOSE_FRIENDS)), {"author", "close"})
        self.assertEqual(self.visible_to(self.post(V.FOLLOWERS)), {"author", "follower"})
        self.assertEqual(self.visible_to(self.post(V.PRIVATE)), {"author"})
        self.assertEqual(self.visible_to(self.post(V.CUSTOM, audience_user_ids=[self.audience.pk])), {"author", "audience"})
        self.assertEqual(self.visible_to(P.create_post(author=self.author, body="g", group=self.group)), {"author", "member"})

    def test_block_hides_everything_both_ways_even_public(self):
        p = self.post(V.PUBLIC)
        F.block_user(self.author, self.stranger)
        self.assertFalse(S.can_view_post(self.stranger.pk, p.pk))
        F.unblock_user(self.author, self.stranger); F.block_user(self.stranger, self.author)
        self.assertFalse(S.can_view_post(self.stranger.pk, p.pk))

    def test_non_published_and_deleted_posts_are_invisible(self):
        p = self.post(V.PUBLIC)
        Post.objects.filter(pk=p.pk).update(status="hidden")
        self.assertFalse(S.can_view_post(self.stranger.pk, p.pk))
        Post.objects.filter(pk=p.pk).update(status="published"); P.delete_post(p.pk, self.author)
        self.assertFalse(S.can_view_post(self.stranger.pk, p.pk))

    def test_private_group_never_leaks_to_public_and_db_requires_group(self):
        p = P.create_post(author=self.author, body="g", group=self.group, visibility=V.PUBLIC)
        self.assertEqual(p.visibility, V.GROUP_MEMBERS)
        with self.assertRaises(DomainError):
            self.post(V.GROUP_MEMBERS)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Post.objects.filter(pk=p.pk).update(group=None)  # visibilite group_members sans groupe


class PostLifecycleTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b = make_user(), make_user()

    def test_create_extracts_hashtags_mentions_and_counts_them(self):
        p = P.create_post(author=self.a, body=f"Hello #Django #django #Python_3 @{self.b.username} @ghost_user")
        self.assertEqual(set(p.post_hashtags.values_list("hashtag__tag", flat=True)), {"django", "python_3"})
        self.assertEqual(Hashtag.objects.get(tag="django").post_count, 1)
        self.assertEqual(list(p.mentions.values_list("user__username", flat=True)), [self.b.username])
        P.edit_post(p.pk, self.a, body="now only #rust")
        self.assertEqual(Hashtag.objects.get(tag="django").post_count, 0)
        self.assertEqual(Hashtag.objects.get(tag="rust").post_count, 1)
        self.assertEqual(p.edits.count(), 1)

    def test_counters_are_maintained_by_triggers_and_reconstructible(self):
        p = P.create_post(author=self.a, body="x")
        P.react_to_post(p.pk, self.b, "like"); P.react_to_post(p.pk, self.a, "love")
        c = P.add_comment(p.pk, self.b, "nice"); P.add_comment(p.pk, self.a, "thx", parent_id=c.pk)
        P.share_post(p.pk, self.b); P.save_post(p.pk, self.b)
        p.refresh_from_db(); c.refresh_from_db()
        self.assertEqual((p.reaction_count, p.comment_count, p.share_count, p.save_count, c.reply_count), (2, 2, 1, 1, 1))
        P.react_to_post(p.pk, self.b, None); P.unsave_post(p.pk, self.b)
        p.refresh_from_db(); self.assertEqual((p.reaction_count, p.save_count), (1, 0))
        Post.objects.filter(pk=p.pk).update(reaction_count=999, comment_count=999)  # corruption simulee
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_recount_post_counters(%s)", [p.pk])
        p.refresh_from_db(); self.assertEqual((p.reaction_count, p.comment_count), (1, 2))

    def test_changing_reaction_type_does_not_double_count_and_is_idempotent(self):
        p = P.create_post(author=self.a, body="x")
        for t in ("like", "like", "love", "celebrate"):
            P.react_to_post(p.pk, self.b, t)
        p.refresh_from_db(); self.assertEqual(p.reaction_count, 1)

    def test_soft_deleted_comment_decrements_counter(self):
        p = P.create_post(author=self.a, body="x")
        c = P.add_comment(p.pk, self.b, "hi")
        Comment.objects.filter(pk=c.pk).update(deleted_at=timezone.now())
        p.refresh_from_db(); self.assertEqual(p.comment_count, 0)
        Comment.objects.filter(pk=c.pk).update(deleted_at=None)
        p.refresh_from_db(); self.assertEqual(p.comment_count, 1)

    def test_comment_depth_is_capped_and_enforced(self):
        p = P.create_post(author=self.a, body="x")
        c0 = P.add_comment(p.pk, self.a, "0"); c1 = P.add_comment(p.pk, self.b, "1", c0.pk)
        c2 = P.add_comment(p.pk, self.a, "2", c1.pk); c3 = P.add_comment(p.pk, self.b, "3", c2.pk)
        self.assertEqual((c0.depth, c1.depth, c2.depth, c3.depth), (0, 1, 2, 2))
        self.assertEqual(c3.parent_id, c1.pk)  # rattache au parent de niveau 1
        with self.assertRaises(IntegrityError), transaction.atomic():
            Comment.objects.create(post=p, author=self.a, body="x", parent=c2, depth=3)

    def test_interactions_require_visibility(self):
        p = P.create_post(author=self.a, body="secret", visibility=V.PRIVATE)
        for fn in (lambda: P.react_to_post(p.pk, self.b, "like"), lambda: P.add_comment(p.pk, self.b, "x"),
                   lambda: P.share_post(p.pk, self.b), lambda: P.save_post(p.pk, self.b)):
            with self.assertRaises(PermissionDeniedError):
                fn()

    def test_only_author_or_group_moderator_can_delete(self):
        g = C.create_group(owner=self.a, name="G", slug="gg")
        C.join_group(self.b, g)
        p = P.create_post(author=self.a, body="in group", group=g)
        with self.assertRaises(PermissionDeniedError):
            P.delete_post(p.pk, self.b)
        P.delete_post(p.pk, self.a)
        self.assertTrue(Post.objects.get(pk=p.pk).is_deleted)

    def test_group_posting_rules_and_mute(self):
        from datetime import timedelta
        g = C.create_group(owner=self.a, name="G", slug="g3")
        with self.assertRaises(PermissionDeniedError):
            P.create_post(author=self.b, body="x", group=g, visibility=V.GROUP_MEMBERS)  # non membre
        C.join_group(self.b, g)
        P.create_post(author=self.b, body="ok", group=g)
        C.mute_member(g, self.a, self.b, timedelta(hours=1))
        with self.assertRaises(PermissionDeniedError):
            P.create_post(author=self.b, body="muted", group=g)

    def test_text_post_cannot_be_empty_at_db_level(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Post.objects.create(author=self.a, kind="text", body="")

    def test_media_limit(self):
        media = [{"kind": "image", "storage_key": f"k{i}", "mime_type": "image/png", "size_bytes": 1} for i in range(11)]
        with self.assertRaises(DomainError):
            P.create_post(author=self.a, kind="image", media=media)

    def test_full_text_search_index_is_usable(self):
        Post.objects.bulk_create([Post(author=self.a, body=f"post numero {i} sur autre chose", published_at=timezone.now()) for i in range(3000)])
        P.create_post(author=self.a, title="Deployer Django", body="sur Render avec Postgres")
        with connection.cursor() as cur:
            cur.execute("ANALYZE social_post")
            cur.execute("EXPLAIN SELECT id FROM social_post WHERE status='published' AND deleted_at IS NULL AND to_tsvector('simple', coalesce(title,'') || ' ' || body) @@ plainto_tsquery('simple','django')")
            self.assertIn("post_fts_idx", "\n".join(r[0] for r in cur.fetchall()))


class PollAndStatusTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b, self.c = make_user(), make_user(), make_user()

    def poll(self, **kw):
        p = P.create_post(author=self.a, kind="poll", body="vote!", poll={"question": "Q?", "options": ["A", "B", "C"], **kw})
        return p, list(p.poll.options.order_by("position"))

    def test_single_choice_poll_counts_and_blocks_double_vote(self):
        p, (oa, ob, oc) = self.poll()
        P.vote_poll(p.pk, self.b, [oa.pk]); P.vote_poll(p.pk, self.c, [oa.pk])
        with self.assertRaises(ConflictError):
            P.vote_poll(p.pk, self.b, [ob.pk])
        with self.assertRaises(DomainError):
            P.vote_poll(p.pk, self.a, [oa.pk, ob.pk])  # multi interdit
        oa.refresh_from_db(); self.assertEqual(oa.vote_count, 2)

    def test_multiple_choice_closed_and_invalid(self):
        p, (oa, ob, _) = self.poll(allows_multiple=True)
        P.vote_poll(p.pk, self.b, [oa.pk, ob.pk])
        self.assertEqual(PollOption.objects.filter(poll=p.poll).values_list("vote_count", flat=True).__len__(), 3)
        closed, (x, *_) = self.poll(closes_at=timezone.now() - timedelta(minutes=1))
        with self.assertRaises(DomainError):
            P.vote_poll(closed.pk, self.b, [x.pk])
        with self.assertRaises(DomainError):
            P.vote_poll(p.pk, self.c, [x.pk])  # option d'un autre sondage

    def test_poll_needs_2_to_10_options(self):
        with self.assertRaises(DomainError):
            P.create_post(author=self.a, kind="poll", poll={"question": "Q", "options": ["only one"]})

    def test_status_visibility_expiry_and_views(self):
        befriend(self.a, self.b)
        s = P.create_status(author=self.a, body="hello", visibility=V.FRIENDS)
        self.assertTrue(S.active_statuses_for(self.b.pk).filter(pk=s.pk).exists())
        self.assertFalse(S.active_statuses_for(self.c.pk).filter(pk=s.pk).exists())
        self.assertTrue(P.view_status(s.pk, self.b)); self.assertFalse(P.view_status(s.pk, self.b))
        self.assertFalse(P.view_status(s.pk, self.a))  # l'auteur ne se compte pas
        with self.assertRaises(PermissionDeniedError):
            P.view_status(s.pk, self.c)
        s.refresh_from_db(); self.assertEqual(s.view_count, 1)
        Status.objects.filter(pk=s.pk).update(created_at=timezone.now() - timedelta(days=2), expires_at=timezone.now() - timedelta(days=1))
        self.assertFalse(S.active_statuses_for(self.b.pk).filter(pk=s.pk).exists())
        self.assertEqual(P.archive_expired_statuses(), 1)

    def test_status_custom_audience_and_db_constraints(self):
        s = P.create_status(author=self.a, body="vip", visibility=V.CUSTOM, audience_user_ids=[self.c.pk])
        self.assertTrue(S.active_statuses_for(self.c.pk).filter(pk=s.pk).exists())
        self.assertFalse(S.active_statuses_for(self.b.pk).filter(pk=s.pk).exists())
        with self.assertRaises(IntegrityError), transaction.atomic():
            Status.objects.create(author=self.a, kind="text", body="x", expires_at=timezone.now() - timedelta(hours=1))


class FeedTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.me, self.friend, self.celeb, self.stranger = (make_user() for _ in range(4))
        befriend(self.me, self.friend)
        F.follow(self.me, self.celeb)

    def relay(self):
        stats = outbox.relay_batch(500)
        self.assertEqual(stats["failed"], 0)
        return stats

    def feed_ids(self, user=None):
        return [c["_id"] for c in feed.get_feed((user or self.me).pk).posts]

    def test_rank_score_properties_and_sql_parity(self):
        base = dict(age_hours=1, reactions=0, comments=0, shares=0)
        self.assertGreater(feed.rank_score(**{**base, "reactions": 10}), feed.rank_score(**base))
        self.assertGreater(feed.rank_score(**base), feed.rank_score(**{**base, "age_hours": 48}))
        self.assertAlmostEqual(feed.rank_score(age_hours=24, reactions=0, comments=0, shares=0), 0.5)
        self.assertGreater(feed.rank_score(**base, affinity=0.5), feed.rank_score(**base))
        with connection.cursor() as cur:
            for args in [(1, 0, 0, 0, 0), (30.5, 12, 3, 1, 0.25), (0, 100, 50, 20, 0.5)]:
                cur.execute("SELECT baobab_feed_score(%s,%s,%s,%s,%s)", args)
                sql = cur.fetchone()[0]
                py = feed.rank_score(age_hours=args[0], reactions=args[1], comments=args[2], shares=args[3], affinity=args[4])
                self.assertTrue(math.isclose(sql, py, rel_tol=1e-9), (args, sql, py))

    def test_fanout_on_write_populates_friend_timeline_and_projects_card(self):
        p = P.create_post(author=self.friend, body="hello #baobab")
        self.relay()
        self.assertEqual(self.feed_ids(), [str(p.pk)])
        card = collection("post_cards").find_one({"_id": str(p.pk)})
        self.assertEqual((card["author"]["username"], card["hashtags"]), (self.friend.username, ["baobab"]))
        self.assertGreater(get_redis().ttl(K.feed(self.me.pk)), 0)
        self.assertEqual(self.feed_ids(self.stranger), [])

    def test_stale_timeline_cannot_leak_after_block_visibility_change_or_delete(self):
        p = P.create_post(author=self.friend, body="x", visibility=V.FRIENDS)
        self.relay()
        self.assertEqual(self.feed_ids(), [str(p.pk)])
        Post.objects.filter(pk=p.pk).update(visibility=V.PRIVATE)  # le ZSET Redis est perime...
        self.assertEqual(self.feed_ids(), [])                       # ...mais la base fait foi
        Post.objects.filter(pk=p.pk).update(visibility=V.FRIENDS)
        F.block_user(self.me, self.friend)
        self.assertEqual(self.feed_ids(), [])

    def test_celebrity_authors_are_pulled_not_pushed(self):
        old, feed.FANOUT_MAX_AUDIENCE = feed.FANOUT_MAX_AUDIENCE, 0
        self.addCleanup(lambda: setattr(feed, "FANOUT_MAX_AUDIENCE", old))
        p = P.create_post(author=self.celeb, body="from a celebrity")
        self.relay()
        self.assertEqual(get_redis().zcard(K.feed(self.me.pk)), 0)           # rien pousse
        self.assertTrue(get_redis().sismember(K.celebrity_authors(), str(self.celeb.pk)))
        self.assertEqual(self.feed_ids(), [str(p.pk)])                        # mais lu a la volee

    def test_group_posts_are_pulled_for_members(self):
        g = C.create_group(owner=self.friend, name="G", slug="gx"); C.join_group(self.me, g)
        p = P.create_post(author=self.friend, body="group news", group=g)
        self.relay()
        self.assertIn(str(p.pk), self.feed_ids())
        self.assertNotIn(str(p.pk), self.feed_ids(self.stranger))

    def test_rebuild_after_redis_loss_and_mongo_loss(self):
        p = P.create_post(author=self.friend, body="resilient")
        self.relay()
        get_redis().flushdb(); collection("post_cards").drop()
        self.assertEqual(self.feed_ids(), [str(p.pk)])  # timeline reconstruite depuis PG + carte reprojetee
        self.assertIsNotNone(collection("post_cards").find_one({"_id": str(p.pk)}))

    def test_ranking_prefers_engaged_recent_content_and_cursor_pages(self):
        quiet = P.create_post(author=self.friend, body="quiet"); hot = P.create_post(author=self.friend, body="hot")
        for u in (self.celeb, self.stranger):
            P.react_to_post(hot.pk, u, "like")
        P.add_comment(hot.pk, self.celeb, "wow")
        self.relay()
        page = feed.get_feed(self.me.pk, limit=1)
        self.assertEqual(page.posts[0]["_id"], str(hot.pk))
        self.assertEqual(page.posts[0]["counters"]["reactions"], 2)  # compteurs de la carte mis a jour par evenement
        older = feed.get_feed(self.me.pk, limit=5, before=page.next_cursor)
        self.assertNotIn(str(hot.pk), [c["_id"] for c in older.posts]) if older.posts else None

    def test_deleted_post_removed_from_cards_and_feed(self):
        p = P.create_post(author=self.friend, body="oops"); self.relay()
        P.delete_post(p.pk, self.friend); self.relay()
        self.assertIsNone(collection("post_cards").find_one({"_id": str(p.pk)}))
        self.assertEqual(self.feed_ids(), [])

    def test_view_counting_is_deduplicated_and_flushed_to_postgres(self):
        from django.core.management import call_command
        p = P.create_post(author=self.friend, body="v")
        self.assertTrue(P.record_view(p.pk, self.me.pk)); self.assertFalse(P.record_view(p.pk, self.me.pk))
        self.assertTrue(P.record_view(p.pk, self.stranger.pk))
        self.relay()
        call_command("flush_counters", verbosity=0)
        p.refresh_from_db(); self.assertEqual(p.view_count, 2)
        call_command("flush_counters", verbosity=0)
        p.refresh_from_db(); self.assertEqual(p.view_count, 2)  # drain atomique : pas de double comptage
