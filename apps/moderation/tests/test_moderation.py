from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, make_user
from apps.messaging import services as M
from apps.moderation import registry, services as MS
from apps.moderation.models import ModerationAction, ModerationCase, Report, UserRestriction
from apps.social import selectors as S, services as P
from apps.social.models import Post


class ModerationTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.author, self.reporter, self.reporter2 = make_user(), make_user(), make_user()
        self.mod = make_user("moderator_1"); self.mod.is_staff = True; self.mod.save()
        self.post = P.create_post(author=self.author, body="bad stuff")

    def report(self, who=None, reason="spam"):
        return MS.report_content(reporter=who or self.reporter, target_type="post", target_id=self.post.pk, reason_code=reason)

    def test_hooks_registered_for_every_moderatable_domain(self):
        self.assertTrue({"post", "comment", "message"} <= set(registry.registered_types()))

    def test_reports_aggregate_into_one_open_case_and_escalate_priority(self):
        r1 = self.report(); r2 = self.report(self.reporter2, "hate")
        self.assertEqual((ModerationCase.objects.count(), r1.case_id == r2.case_id), (1, True))
        self.assertEqual(ModerationCase.objects.get().priority, 4)
        self.assertEqual(ModerationCase.objects.get().subject_user_id, self.author.pk)

    def test_report_validation(self):
        self.report()
        with self.assertRaises(ConflictError):
            self.report()
        with self.assertRaises(DomainError):
            MS.report_content(reporter=self.author, target_type="post", target_id=self.post.pk, reason_code="spam")
        with self.assertRaises(DomainError):
            MS.report_content(reporter=self.reporter, target_type="unknown", target_id=self.post.pk, reason_code="spam")

    def test_hide_restore_remove_apply_effects_via_hooks_and_audit(self):
        case = self.report().case
        MS.apply_action(moderator=self.mod, case=case, action="hide", reason="violates rules")
        self.post.refresh_from_db(); self.assertEqual(self.post.status, "hidden")
        self.assertFalse(S.can_view_post(self.reporter.pk, self.post.pk))
        case.refresh_from_db(); self.assertEqual(case.status, "resolved")
        self.assertEqual(Report.objects.get().status, "actioned")
        self.assertTrue(AuditLog.objects.filter(action="moderation.hide", object_id=str(self.post.pk)).exists())
        with self.assertRaises(ConflictError):
            MS.apply_action(moderator=self.mod, case=case, action="remove", reason="again")
        case2 = self.report(self.reporter2).case
        MS.apply_action(moderator=self.mod, case=case2, action="restore", reason="appeal accepted")
        self.post.refresh_from_db(); self.assertEqual(self.post.status, "published")

    def test_only_staff_can_apply_actions(self):
        with self.assertRaises(PermissionDeniedError):
            MS.apply_action(moderator=self.reporter, case=self.report().case, action="hide", reason="x")

    def test_moderation_actions_are_immutable(self):
        act = MS.apply_action(moderator=self.mod, case=self.report().case, action="hide", reason="r")
        for fn in (lambda: ModerationAction.objects.filter(pk=act.pk).update(reason="tampered"), lambda: ModerationAction.objects.filter(pk=act.pk).delete()):
            with self.assertRaises(Exception), transaction.atomic():
                fn()

    def test_suspension_replaces_previous_and_database_forbids_overlap(self):
        until = timezone.now() + timedelta(days=3)
        for _ in range(2):  # deux sanctions successives : la 2e remplace la 1re sans violer la contrainte d'exclusion
            case = MS.report_content(reporter=make_user(), target_type="post", target_id=self.post.pk, reason_code="scam").case
            MS.apply_action(moderator=self.mod, case=case, action="suspend", reason="scam", expires_at=until)
        active = MS.active_restrictions(self.author.pk, "suspension")
        self.assertEqual(active.count(), 1)
        self.author.refresh_from_db(); self.assertEqual(self.author.status, "suspended")
        with self.assertRaises(IntegrityError), transaction.atomic():  # insertion directe chevauchante
            UserRestriction.objects.create(user=self.author, kind="suspension", reason="dup", ends_at=until)

    def test_strikes_escalate_warnings_to_suspension(self):
        for i in range(5):
            case = MS.report_content(reporter=make_user(), target_type="post", target_id=self.post.pk, reason_code="spam").case
            MS.apply_action(moderator=self.mod, case=case, action="warning", reason=f"w{i}", policy_code="spam")
        self.author.refresh_from_db()
        self.assertEqual(self.author.status, "suspended")
        self.assertTrue(MS.active_restrictions(self.author.pk, "suspension").exists())

    def test_message_reports_work_across_domains_without_import(self):
        a, b = self.author, self.reporter
        conv, _ = M.get_or_create_direct(a, b)
        msg = M.send_message(conversation_id=conv.pk, sender=a, body="insult")
        case = MS.report_content(reporter=b, target_type="message", target_id=msg.pk, reason_code="harassment").case
        MS.apply_action(moderator=self.mod, case=case, action="remove", reason="harassment")
        msg.refresh_from_db(); self.assertIsNotNone(msg.deleted_at)
