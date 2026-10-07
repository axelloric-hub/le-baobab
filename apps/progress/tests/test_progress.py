import re

from django.db import IntegrityError, connection, transaction

from apps.assessments import services as A
from apps.core import outbox
from apps.core.exceptions import DomainError, PermissionDeniedError, RateLimitedError
from apps.core.models import OutboxEvent
from apps.core.testing import BaobabTestCase, make_user
from apps.education import services as E
from apps.education.models import Enrollment
from apps.education.testing import make_course
from apps.progress import services as P
from apps.progress.models import Certificate, CertificateVerification, ChapterProgress


class ProgressTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_course()
        self.u = make_user()
        E.enroll(self.u, self.k.course)

    def unlock_all(self):
        E.grant_entitlement(self.u, "course", self.k.course, source="purchase", grant_key=f"all-{self.u.pk}")

    def test_progress_is_monotone_time_is_capped_and_values_validated(self):
        P.record_progress(self.u, self.k.c1.pk, percent=60, seconds=120)
        cp = P.record_progress(self.u, self.k.c1.pk, percent=30, seconds=99999)
        self.assertEqual((cp.percent, cp.time_spent_seconds, cp.status), (60, 120 + P.MAX_SECONDS_PER_CALL, "in_progress"))  # ne recule pas ; temps plafonne par appel
        for bad in ({"percent": 101}, {"percent": -1}, {"percent": 10, "seconds": -5}):
            with self.assertRaises(DomainError):
                P.record_progress(self.u, self.k.c1.pk, **bad)

    def test_progress_requires_access(self):
        with self.assertRaises(PermissionDeniedError) as cm:
            P.complete_chapter(self.u, self.k.c3.pk)
        self.assertEqual(cm.exception.code, "payment_required")
        with self.assertRaises(PermissionDeniedError):
            P.complete_chapter(make_user(), self.k.c4.pk)

    def test_sql_progress_counts_only_published_chapters(self):
        self.unlock_all()
        P.complete_chapter(self.u, self.k.c1.pk)
        P.complete_chapter(self.u, self.k.c2.pk)
        self.assertEqual(P.course_progress(self.u, self.k.course), {"total_chapters": 5, "completed_chapters": 2, "percent": 40.0, "time_spent_seconds": 0})
        E.add_chapter(self.k.m1, self.k.teacher, title="brouillon")  # non publie : ne compte pas
        self.assertEqual(P.course_progress(self.u, self.k.course)["total_chapters"], 5)
        self.assertEqual(P.module_progress(self.u, self.k.m1)["percent"], 100.0)
        self.assertEqual(P.module_progress(self.u, self.k.m2)["percent"], 33.33)

    def test_completing_everything_completes_the_enrollment_and_issues_one_certificate(self):
        self.unlock_all()
        for ch in (self.k.c1, self.k.c2, self.k.c3, self.k.c4):
            P.complete_chapter(self.u, ch.pk)
        self.assertEqual(Enrollment.objects.get(user=self.u).status, "active")
        self.assertFalse(Certificate.objects.exists())
        P.complete_chapter(self.u, self.k.c5.pk)
        P.complete_chapter(self.u, self.k.c5.pk)  # rejouer ne change rien
        e = Enrollment.objects.get(user=self.u)
        self.assertEqual((e.status, e.completed_at is not None), ("completed", True))
        cert = Certificate.objects.get()
        self.assertTrue(re.fullmatch(r"BAO-[A-HJ-NP-Z2-9]{12}", cert.verification_code))
        self.assertEqual(P.try_issue_certificate(self.u, self.k.course).pk, cert.pk)  # idempotent
        self.assertEqual(set(OutboxEvent.objects.filter(event_type__in=["ChapterCompleted", "CourseCompleted", "CertificateIssued"]).values_list("event_type", flat=True)),
                         {"ChapterCompleted", "CourseCompleted", "CertificateIssued"})

    def test_database_allows_a_single_active_certificate_per_user_and_course(self):
        self.unlock_all()
        for ch in (self.k.c1, self.k.c2, self.k.c3, self.k.c4, self.k.c5):
            P.complete_chapter(self.u, ch.pk)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Certificate.objects.create(user=self.u, course=self.k.course, verification_code="BAO-DUPLICATE0001")
        with self.assertRaises(IntegrityError), transaction.atomic():
            ChapterProgress.objects.filter(user=self.u).update(percent=50)  # 'completed' exige 100 %

    def test_course_without_certificate_option_issues_none(self):
        self.k.course.certificate_enabled = False
        self.k.course.save()
        self.unlock_all()
        for ch in (self.k.c1, self.k.c2, self.k.c3, self.k.c4, self.k.c5):
            P.complete_chapter(self.u, ch.pk)
        self.assertFalse(Certificate.objects.exists())

    def test_certificate_waits_for_quizzes_then_is_issued_by_event_when_the_quiz_is_passed(self):
        quiz = A.create_quiz(self.k.course, self.k.teacher, title="Final", pass_percent=50)
        A.add_question(quiz, self.k.teacher, kind="single", prompt="2+2 ?", choices=[{"label": "4", "is_correct": True}, {"label": "5"}])
        quiz.is_published = True
        quiz.save()
        self.unlock_all()
        for ch in (self.k.c1, self.k.c2, self.k.c3, self.k.c4, self.k.c5):
            P.complete_chapter(self.u, ch.pk)
        self.assertEqual(Enrollment.objects.get(user=self.u).status, "completed")
        self.assertFalse(Certificate.objects.exists())  # cours termine mais quiz non reussi
        att = A.start_attempt(self.u, quiz.pk)
        q = quiz.questions.get()
        right = str(q.choices.get(is_correct=True).pk)
        res = A.submit_attempt(self.u, att.pk, {str(q.pk): {"selected": [right]}})
        self.assertTrue(res.passed)
        outbox.relay_batch(100)  # QuizPassed -> progress.handlers -> certificat
        self.assertEqual(Certificate.objects.get().score_percent, 100)

    def test_public_verification_exposes_no_private_data_logs_and_is_rate_limited(self):
        self.unlock_all()
        for ch in (self.k.c1, self.k.c2, self.k.c3, self.k.c4, self.k.c5):
            P.complete_chapter(self.u, ch.pk)
        cert = Certificate.objects.get()
        out = P.verify_certificate(cert.verification_code.lower(), ip="1.2.3.4")
        self.assertEqual(out["valid"], True)
        self.assertEqual(set(out), {"valid", "holder", "course", "issued_at", "score_percent"})
        self.assertNotIn("@", str(out))
        self.assertEqual(P.verify_certificate("BAO-NOPE00000000", ip="1.2.3.4"), {"valid": False})
        self.assertEqual(CertificateVerification.objects.filter(certificate=cert).count(), 1)
        admin = make_user(); admin.is_staff = True; admin.save()
        with self.assertRaises(PermissionDeniedError):
            P.revoke_certificate(cert.pk, by=self.u, reason="x")
        P.revoke_certificate(cert.pk, by=admin, reason="fraude")
        self.assertEqual(P.verify_certificate(cert.verification_code), {"valid": False, "revoked": True})
        with self.assertRaises(RateLimitedError):
            for _ in range(40):
                P.verify_certificate("BAO-GUESSING0000", ip="9.9.9.9")

    def test_leaderboard_function_ranks_by_completion_then_time(self):
        self.unlock_all()
        v = make_user()
        E.enroll(v, self.k.course)
        P.record_progress(self.u, self.k.c1.pk, percent=100, seconds=50)
        P.record_progress(self.u, self.k.c2.pk, percent=100, seconds=50)
        P.record_progress(v, self.k.c1.pk, percent=100, seconds=10)
        with connection.cursor() as cur:
            cur.execute("SELECT user_id, completed_chapters, rank FROM baobab_course_leaderboard(%s)", [self.k.course.pk])
            rows = cur.fetchall()
        self.assertEqual([(str(r[0]), r[1], r[2]) for r in rows], [(str(self.u.pk), 2, 1), (str(v.pk), 1, 2)])
