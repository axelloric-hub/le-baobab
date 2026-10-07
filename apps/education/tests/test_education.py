import threading
from datetime import timedelta

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, connection, connections, transaction
from django.utils import timezone

from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.education import services as E
from apps.education.access import access_decision
from apps.education.models import Chapter, Classroom, ContentBlock, Course, Enrollment, Entitlement, Module
from apps.education.testing import make_course


class PricingConstraintTests(BaobabTestCase):
    """Le modele de prix est garanti PAR LA BASE (pas seulement par les services)."""

    def setUp(self):
        super().setUp()
        self.k = make_course(publish=False)

    def bad(self, fn):
        with self.assertRaises(IntegrityError), transaction.atomic():
            fn()

    def test_free_with_price_and_paid_without_price_are_rejected_at_every_level(self):
        m, ch, co, cl = self.k.m1, self.k.c1, self.k.course, self.k.classroom
        self.bad(lambda: Chapter.objects.filter(pk=ch.pk).update(price_minor=100, currency="XAF"))      # gratuit + prix
        self.bad(lambda: Chapter.objects.filter(pk=ch.pk).update(is_free=False))                          # payant sans prix
        self.bad(lambda: Module.objects.filter(pk=m.pk).update(is_free=False, price_minor=0, currency="XAF"))  # prix nul
        self.bad(lambda: Course.objects.filter(pk=co.pk).update(is_free=False, price_minor=10, currency=""))   # sans devise
        self.bad(lambda: Classroom.objects.filter(pk=cl.pk).update(is_paid=True))

    def test_service_translates_the_violation_into_a_clear_error(self):
        with self.assertRaises(DomainError) as cm:
            E.add_chapter(self.k.m1, self.k.teacher, title="x", is_free=False)
        self.assertEqual(cm.exception.code, "invalid_pricing")

    def test_block_must_contain_what_its_type_requires(self):
        ch = self.k.c1
        for kw in ({"kind": "text", "body": ""}, {"kind": "pdf"}, {"kind": "link", "url": "http://insecure.example.com"}, {"kind": "quiz"}):
            with self.assertRaises(DomainError, msg=str(kw)):
                E.add_block(ch, self.k.teacher, **kw)
        E.add_block(ch, self.k.teacher, kind="pdf", storage_key="docs/a.pdf")
        E.add_block(ch, self.k.teacher, kind="link", url="https://example.com")
        self.assertEqual(list(ch.blocks.order_by("position").values_list("position", flat=True)), [1, 2, 3])  # position 1 = bloc texte de la fabrique ; les suivants s'ajoutent sans trou

    def test_positions_are_unique_per_parent(self):
        """Contrainte DIFFEREE (permet de reordonner dans une transaction) : elle se verifie au commit ; on la force ici."""
        with self.assertRaises(IntegrityError), transaction.atomic():
            Chapter.objects.create(module=self.k.m1, position=1, title="dup")
            connection.cursor().execute("SET CONSTRAINTS ALL IMMEDIATE")


class ClassroomMembershipTests(BaobabTestCase):
    def test_join_policies(self):
        t = make_user()
        public = E.create_classroom(owner=t, title="P", slug="p")
        private = E.create_classroom(owner=t, title="Pr", slug="pr", privacy="private")
        invite = E.create_classroom(owner=t, title="I", slug="i", privacy="invite_only")
        u = make_user()
        self.assertEqual(E.join_classroom(u, public).status, "active")
        pending = E.join_classroom(u, private)
        self.assertEqual(pending.status, "pending")
        with self.assertRaises(ConflictError):
            E.join_classroom(u, private)
        with self.assertRaises(PermissionDeniedError):
            E.join_classroom(u, invite)
        with self.assertRaises(PermissionDeniedError):
            E.review_member(private, u, pending.pk, True)  # un etudiant ne valide pas
        self.assertEqual(E.review_member(private, t, pending.pk, True).status, "active")

    def test_invitation_flow_and_ban(self):
        t, u = make_user(), make_user()
        c = E.create_classroom(owner=t, title="I", slug="inv", privacy="invite_only")
        inv = E.invite_to_classroom(c, t, u)
        with self.assertRaises(ConflictError):
            E.invite_to_classroom(c, t, u)
        E.respond_to_classroom_invitation(inv.pk, u, True)
        self.assertEqual(c.members.get(user=u).status, "active")
        E.ban_member(c, t, u)
        with self.assertRaises(PermissionDeniedError):
            E.join_classroom(u, c)
        E.leave_classroom(u, c)  # partir ne leve pas un bannissement
        self.assertEqual(c.members.get(user=u).status, "banned")
        with self.assertRaises(PermissionDeniedError):
            E.ban_member(c, t, t)

    def test_owner_cannot_leave_and_only_staff_invites(self):
        t, u, v = make_user(), make_user(), make_user()
        c = E.create_classroom(owner=t, title="X", slug="x")
        with self.assertRaises(DomainError):
            E.leave_classroom(t, c)
        E.join_classroom(u, c)
        with self.assertRaises(PermissionDeniedError):
            E.invite_to_classroom(c, u, v)


class AccessMatrixTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_course()
        self.u = make_user()

    def d(self, chapter, user=None):
        return access_decision(user or self.u, Chapter.objects.select_related("module__course__classroom").get(pk=chapter.pk))

    def test_free_chapters_are_public_previews_even_for_anonymous_but_paid_ones_are_not(self):
        anon = AnonymousUser()
        self.assertEqual((self.d(self.k.c1, anon).allowed, self.d(self.k.c2, anon).allowed), (True, True))  # gratuit, y compris dans un module payant
        self.assertEqual(self.d(self.k.c3, anon).reason, "enroll_required")

    def test_paid_chapter_requires_enrollment_then_payment(self):
        self.assertEqual(self.d(self.k.c3).reason, "enroll_required")
        E.enroll(self.u, self.k.course)
        self.assertEqual(self.d(self.k.c3).reason, "payment_required")
        self.assertTrue(self.d(self.k.c1))  # le gratuit reste accessible

    def test_entitlement_scopes_unlock_exactly_their_perimeter(self):
        E.enroll(self.u, self.k.course)
        E.grant_entitlement(self.u, "chapter", self.k.c3, source="purchase", grant_key="o1:c3")
        self.assertEqual((self.d(self.k.c3).allowed, self.d(self.k.c4).reason, self.d(self.k.c5).reason), (True, "payment_required", "payment_required"))
        E.grant_entitlement(self.u, "module", self.k.m2, source="purchase", grant_key="o2:m2")
        self.assertEqual((self.d(self.k.c4).allowed, self.d(self.k.c5).reason), (True, "payment_required"))  # le module ne debloque pas le module voisin
        E.grant_entitlement(self.u, "course", self.k.course, source="purchase", grant_key="o3:course")
        self.assertTrue(self.d(self.k.c5))

    def test_expired_and_revoked_entitlements_do_not_unlock(self):
        E.enroll(self.u, self.k.course)
        ent, _ = E.grant_entitlement(self.u, "chapter", self.k.c3, source="purchase", grant_key="a", expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.d(self.k.c3).reason, "payment_required")
        ent2, _ = E.grant_entitlement(self.u, "chapter", self.k.c4, source="purchase", grant_key="b")
        self.assertTrue(self.d(self.k.c4))
        admin = make_user(); admin.is_staff = True; admin.save()
        E.revoke_entitlement(ent2.pk, by=admin)
        self.assertEqual(self.d(self.k.c4).reason, "payment_required")

    def test_python_decision_and_sql_function_agree(self):
        E.enroll(self.u, self.k.course)
        E.grant_entitlement(self.u, "module", self.k.m2, source="purchase", grant_key="m2")
        with connection.cursor() as cur:
            for ch in (self.k.c1, self.k.c2, self.k.c3, self.k.c4, self.k.c5):
                cur.execute("SELECT baobab_chapter_unlocked(%s,%s)", [self.u.pk, ch.pk])
                self.assertEqual(cur.fetchone()[0], self.d(ch).allowed, ch.title)

    def test_private_classroom_requires_active_membership(self):
        k = make_course(privacy="private")
        self.assertEqual(self.d(k.c1, self.u).reason, "membership_required")
        with self.assertRaises(PermissionDeniedError):
            E.enroll(self.u, k.course)
        m = E.join_classroom(self.u, k.classroom)  # en attente : toujours refuse
        self.assertEqual(self.d(k.c1, self.u).reason, "membership_required")
        E.review_member(k.classroom, k.teacher, m.pk, True)
        self.assertEqual(self.d(k.c1, self.u).reason, "enroll_required")  # membre, mais pas d'apercu hors classroom publique
        E.enroll(self.u, k.course)
        self.assertTrue(self.d(k.c1, self.u))

    def test_paid_classroom_gates_everything_including_free_chapters(self):
        k = make_course(classroom_paid=True)
        with self.assertRaises(PermissionDeniedError):
            E.enroll(self.u, k.course)
        self.assertEqual(self.d(k.c1, self.u).reason, "classroom_payment_required")  # plus d'apercu public : la classroom est payante
        E.grant_entitlement(self.u, "classroom", k.classroom, source="purchase", grant_key="cl")
        E.enroll(self.u, k.course)
        self.assertTrue(self.d(k.c1, self.u))
        self.assertTrue(self.d(k.c3, self.u))  # le droit de classroom debloque aussi les chapitres payants

    def test_drafts_hidden_from_students_visible_to_staff(self):
        k = make_course(publish=False)
        self.assertEqual(self.d(k.c1, self.u).reason, "not_published")
        self.assertTrue(self.d(k.c1, k.teacher))
        self.assertEqual(self.d(k.c1, make_user()).reason, "not_published")

    def test_banned_member_loses_access_and_enrollments(self):
        E.enroll(self.u, self.k.course)
        E.ban_member(self.k.classroom, self.k.teacher, self.u)
        self.assertEqual(Enrollment.objects.get(user=self.u).status, "dropped")
        with self.assertRaises(PermissionDeniedError):
            E.enroll(self.u, self.k.course)


class PublishingTests(BaobabTestCase):
    def test_empty_course_and_paid_module_without_paid_chapter_cannot_publish(self):
        t = make_user()
        cl = E.create_classroom(owner=t, title="C", slug="cc")
        co = E.create_course(classroom=cl, creator=t, title="T", slug="t")
        with self.assertRaises(DomainError) as cm:
            E.publish_course(co, t)
        self.assertEqual(cm.exception.code, "empty_course")
        m = E.add_module(co, t, title="M", is_free=False, price_minor=1000, currency="XAF")
        E.add_chapter(m, t, title="gratuit", is_free=True)
        with self.assertRaises(DomainError) as cm:
            E.publish_course(co, t)
        self.assertEqual(cm.exception.code, "paid_module_without_paid_chapter")
        E.add_chapter(m, t, title="payant", is_free=False, price_minor=500, currency="XAF")
        self.assertEqual(E.publish_course(co, t).status, "published")

    def test_only_course_staff_edits_and_instructor_management(self):
        k = make_course(publish=False)
        stranger, helper = make_user(), make_user()
        with self.assertRaises(PermissionDeniedError):
            E.add_module(k.course, stranger, title="x")
        with self.assertRaises(DomainError):
            E.add_instructor(k.course, k.teacher, helper)  # doit etre membre de la classroom d'abord
        E.join_classroom(helper, k.classroom)
        E.add_instructor(k.course, k.teacher, helper)
        E.add_module(k.course, helper, title="par le co-enseignant")
        self.assertEqual(k.course.instructors.count(), 2)
        with self.assertRaises(PermissionDeniedError):
            E.add_instructor(k.course, helper, stranger)  # seul le principal ajoute


class EnrollmentTests(BaobabTestCase):
    def test_idempotent_drop_and_reenroll_and_unpublished(self):
        k = make_course()
        u = make_user()
        e1, created1 = E.enroll(u, k.course)
        e2, created2 = E.enroll(u, k.course)
        self.assertEqual((e1.pk, created1, created2), (e2.pk, True, False))
        E.drop_enrollment(u, k.course)
        e3, created3 = E.enroll(u, k.course)
        self.assertEqual((e3.pk, created3, e3.status), (e1.pk, False, "active"))
        draft = make_course(publish=False)
        with self.assertRaises(DomainError):
            E.enroll(u, draft.course)

    def test_enrollment_event_targets_instructors(self):
        from apps.core import outbox
        from apps.notifications.models import Notification
        k = make_course()
        u = make_user()
        E.enroll(u, k.course)
        outbox.relay_batch(100)
        self.assertTrue(Notification.objects.filter(recipient=k.teacher, type_id="course_enrollment").exists())


class EntitlementTests(BaobabTestCase):
    def test_grant_is_idempotent_and_single_target_enforced(self):
        k = make_course()
        u = make_user()
        a, ca = E.grant_entitlement(u, "chapter", k.c3, source="purchase", source_ref="order-1", grant_key="order-1:c3")
        b, cb = E.grant_entitlement(u, "chapter", k.c3, source="purchase", source_ref="order-1", grant_key="order-1:c3")  # webhook rejoue
        self.assertEqual((a.pk, ca, cb), (b.pk, True, False))
        self.assertEqual(Entitlement.objects.count(), 1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Entitlement.objects.create(user=u, scope="chapter", chapter=k.c3, course=k.course, source="grant")  # deux cibles
        with self.assertRaises(IntegrityError), transaction.atomic():
            Entitlement.objects.create(user=u, scope="course", chapter=k.c3, source="grant")  # cible differente de la portee

    def test_only_teachers_can_offer_access_and_only_admins_revoke(self):
        k = make_course()
        u, other = make_user(), make_user()
        with self.assertRaises(PermissionDeniedError):
            E.grant_entitlement(u, "course", k.course, source="grant", granted_by=other)
        ent, _ = E.grant_entitlement(u, "course", k.course, source="instructor", granted_by=k.teacher)
        with self.assertRaises(PermissionDeniedError):
            E.revoke_entitlement(ent.pk, by=k.teacher)


class EnrollmentConcurrencyTests(BaobabTransactionTestCase):
    def test_parallel_enrollments_and_grants_create_exactly_one_row(self):
        k = make_course()
        u = make_user()
        errors = []

        def worker():
            try:
                E.enroll(u, k.course)
                E.grant_entitlement(u, "chapter", k.c3, source="purchase", grant_key="same-webhook")
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker) for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(errors, [])
        self.assertEqual((Enrollment.objects.filter(user=u).count(), Entitlement.objects.filter(user=u).count()), (1, 1))
