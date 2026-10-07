from datetime import timedelta

from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.community import selectors as S
from apps.community import services as C
from apps.community.models import Channel, Group, GroupRole
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, make_user


class GroupTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.owner, self.u1, self.u2 = make_user(), make_user(), make_user()
        self.g = C.create_group(owner=self.owner, name="Django CM", slug="django-cm")

    def test_create_group_builds_roles_and_owner_membership(self):
        self.assertEqual(set(self.g.roles.values_list("name", flat=True)), {"owner", "moderator", "member"})
        self.assertEqual(S.get_membership(self.owner.pk, self.g.pk).role.name, "owner")
        self.assertTrue(S.can(self.owner.pk, self.g.pk, "member.ban"))

    def test_member_count_is_maintained_by_trigger_on_join_and_leave(self):
        self.g.refresh_from_db(); self.assertEqual(self.g.member_count, 1)
        C.join_group(self.u1, self.g); C.join_group(self.u2, self.g)
        self.g.refresh_from_db(); self.assertEqual(self.g.member_count, 3)
        C.leave_group(self.u1, self.g)
        self.g.refresh_from_db(); self.assertEqual(self.g.member_count, 2)

    def test_database_guarantees_single_default_role_per_group(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            GroupRole.objects.create(group=self.g, name="another-default", is_default=True)

    def test_join_policies(self):
        approval = C.create_group(owner=self.owner, name="Prive", slug="prive", join_policy=Group.JoinPolicy.APPROVAL)
        req = C.join_group(self.u1, approval)
        with self.assertRaises(ConflictError):
            C.join_group(self.u1, approval)
        with self.assertRaises(PermissionDeniedError):  # un simple membre ne peut pas approuver
            C.review_join_request(req.pk, self.u2, True)
        C.review_join_request(req.pk, self.owner, True)
        self.assertIsNotNone(S.get_membership(self.u1.pk, approval.pk))
        invite = C.create_group(owner=self.owner, name="Inv", slug="inv", join_policy=Group.JoinPolicy.INVITE_ONLY)
        with self.assertRaises(PermissionDeniedError):
            C.join_group(self.u1, invite)
        inv = C.invite_user(invite, self.owner, self.u1)
        C.respond_to_invitation(inv.pk, self.u1, True)
        self.assertIsNotNone(S.get_membership(self.u1.pk, invite.pk))

    def test_double_join_and_owner_leaving_are_rejected(self):
        C.join_group(self.u1, self.g)
        with self.assertRaises(ConflictError):
            C.join_group(self.u1, self.g)
        with self.assertRaises(DomainError):
            C.leave_group(self.owner, self.g)

    def test_ban_removes_member_blocks_rejoin_and_respects_hierarchy(self):
        C.join_group(self.u1, self.g); C.join_group(self.u2, self.g)
        with self.assertRaises(PermissionDeniedError):
            C.ban_member(self.g, self.u1, self.u2)  # simple membre
        C.ban_member(self.g, self.owner, self.u1, reason="spam")
        self.assertIsNone(S.get_membership(self.u1.pk, self.g.pk))
        with self.assertRaises(PermissionDeniedError):
            C.join_group(self.u1, self.g)
        mod = self.u2
        mod_role = self.g.roles.get(name="moderator")
        S.get_membership(mod.pk, self.g.pk).__class__.objects.filter(user=mod, group=self.g).update(role=mod_role)
        S.invalidate_permissions(mod.pk, self.g.pk)
        with self.assertRaises(PermissionDeniedError):
            C.ban_member(self.g, mod, self.owner)  # on ne bannit pas un rang superieur

    def test_expired_ban_no_longer_blocks(self):
        C.ban_member(self.g, self.owner, self.u1, expires_at=timezone.now() - timedelta(seconds=1))
        self.assertFalse(S.is_banned(self.u1.pk, self.g.pk))

    def test_permissions_are_cached_and_invalidated(self):
        C.join_group(self.u1, self.g)
        self.assertTrue(S.can(self.u1.pk, self.g.pk, "post.create"))
        from apps.core.redis import get_redis
        from apps.core import redis_keys as K
        key = K.user_permissions(self.u1.pk) + f":g:{self.g.pk}"
        self.assertGreater(get_redis().ttl(key), 0)
        C.mute_member(self.g, self.owner, self.u1, timedelta(hours=1))  # invalide le cache
        self.assertFalse(S.can(self.u1.pk, self.g.pk, "post.create"))

    def test_sql_permission_function_matches_python(self):
        C.join_group(self.u1, self.g)
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_group_has_permission(%s,%s,'post.create'), baobab_group_has_permission(%s,%s,'member.ban')", [self.u1.pk, self.g.pk] * 2)
            self.assertEqual(cur.fetchone(), (True, False))

    def test_private_group_content_hidden_from_non_members(self):
        private = C.create_group(owner=self.owner, name="Secret", slug="secret", privacy=Group.Privacy.PRIVATE)
        self.assertFalse(S.can_view_group_content(self.u1.pk, private))
        self.assertTrue(S.can_view_group_content(self.owner.pk, private))
        self.assertTrue(S.can_view_group_content(self.u1.pk, self.g))  # groupe public

    def test_channel_requires_exactly_one_parent(self):
        Channel.objects.create(group=self.g, slug="general", name="General")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Channel.objects.create(slug="orphan", name="Orphan")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Channel.objects.create(group=self.g, slug="general", name="Dup")
