from django.db import IntegrityError, transaction

from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, make_user
from apps.friends import selectors as S
from apps.friends import services as F
from apps.friends.models import Block, Follow, Friendship


class FriendshipTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b, self.c = make_user(), make_user(), make_user()

    def test_one_row_per_pair_regardless_of_direction(self):
        F.send_friend_request(self.a, self.b)
        with self.assertRaises(ConflictError):
            F.send_friend_request(self.a, self.b)
        self.assertEqual(Friendship.objects.count(), 1)
        f = Friendship.objects.get()
        self.assertLess(str(f.user_low_id), str(f.user_high_id))

    def test_crossed_requests_auto_accept(self):
        F.send_friend_request(self.a, self.b)
        f = F.send_friend_request(self.b, self.a)
        self.assertEqual(f.status, "accepted")
        self.assertTrue(S.are_friends(self.a.pk, self.b.pk) and S.are_friends(self.b.pk, self.a.pk))

    def test_only_the_recipient_can_respond(self):
        f = F.send_friend_request(self.a, self.b)
        with self.assertRaises(PermissionDeniedError):
            F.respond_to_request(f.pk, self.a, True)
        with self.assertRaises(PermissionDeniedError):
            F.respond_to_request(f.pk, self.c, True)
        self.assertEqual(F.respond_to_request(f.pk, self.b, True).status, "accepted")
        with self.assertRaises(ConflictError):
            F.respond_to_request(f.pk, self.b, False)

    def test_declined_request_can_be_retried(self):
        f = F.send_friend_request(self.a, self.b)
        F.respond_to_request(f.pk, self.b, False)
        self.assertEqual(F.send_friend_request(self.a, self.b).status, "pending")

    def test_friend_ids_is_bidirectional(self):
        for other in (self.b, self.c):
            F.respond_to_request(F.send_friend_request(self.a, other).pk, other, True)
        self.assertEqual(set(S.friend_ids(self.a.pk)), {self.b.pk, self.c.pk})
        self.assertEqual(set(S.friend_ids(self.b.pk)), {self.a.pk})

    def test_db_enforces_pair_ordering_and_no_self_follow(self):
        hi, lo = sorted([self.a.pk, self.b.pk], key=str, reverse=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Friendship.objects.create(user_low_id=hi, user_high_id=lo, requested_by_id=hi)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Follow.objects.create(follower=self.a, followee=self.a)
        low, high = Friendship.ordered_pair(self.a.pk, self.b.pk)
        with self.assertRaises(IntegrityError), transaction.atomic():  # demandeur hors de la paire
            Friendship.objects.create(user_low_id=low, user_high_id=high, requested_by=self.c)

    def test_block_purges_relations_and_prevents_new_ones(self):
        F.respond_to_request(F.send_friend_request(self.a, self.b).pk, self.b, True)
        F.follow(self.a, self.b)
        F.follow(self.b, self.a)
        F.add_close_friend(self.a, self.b)
        F.block_user(self.a, self.b)
        self.assertFalse(S.are_friends(self.a.pk, self.b.pk))
        self.assertEqual(Follow.objects.count(), 0)
        self.assertTrue(S.is_blocked_either_way(self.b.pk, self.a.pk))
        for fn in (F.send_friend_request, F.follow):
            with self.assertRaises(PermissionDeniedError):
                fn(self.b, self.a)
        F.unblock_user(self.a, self.b)
        self.assertEqual(Block.objects.count(), 0)

    def test_self_relations_rejected(self):
        for fn in (F.send_friend_request, F.follow, F.block_user):
            with self.assertRaises(DomainError):
                fn(self.a, self.a)

    def test_close_friend_requires_friendship_and_is_unidirectional(self):
        with self.assertRaises(DomainError):
            F.add_close_friend(self.a, self.b)
        F.respond_to_request(F.send_friend_request(self.a, self.b).pk, self.b, True)
        F.add_close_friend(self.a, self.b)
        self.assertEqual(self.a.close_friends.count(), 1)
        self.assertEqual(self.b.close_friends.count(), 0)

    def test_follow_is_idempotent_and_distinct_from_friendship(self):
        F.follow(self.a, self.b)
        F.follow(self.a, self.b)
        self.assertEqual(Follow.objects.count(), 1)
        self.assertFalse(S.are_friends(self.a.pk, self.b.pk))
        self.assertEqual(list(S.follower_ids(self.b.pk)), [self.a.pk])

    def test_sql_function_agrees_with_python(self):
        from django.db import connection

        F.respond_to_request(F.send_friend_request(self.a, self.b).pk, self.b, True)
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_are_friends(%s, %s), baobab_are_friends(%s, %s), baobab_are_friends(%s, %s)",
                        [self.a.pk, self.b.pk, self.b.pk, self.a.pk, self.a.pk, self.c.pk])
            self.assertEqual(cur.fetchone(), (True, True, False))
