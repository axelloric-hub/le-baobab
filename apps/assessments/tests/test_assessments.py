import threading
from datetime import timedelta
from decimal import Decimal

from django.db import connections
from django.utils import timezone

from apps.assessments import services as A
from apps.assessments.models import Quiz, QuizAttempt
from apps.core import outbox
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.models import OutboxEvent
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.education import services as E
from apps.education.testing import make_course
from apps.notifications.models import Notification


def student(k):
    u = make_user()
    E.enroll(u, k.course)
    return u


class QuizQuestionValidationTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_course()
        self.quiz = A.create_quiz(self.k.course, self.k.teacher, title="Q")

    def bad(self, **kw):
        with self.assertRaises(DomainError, msg=str(kw)):
            A.add_question(self.quiz, self.k.teacher, prompt="?", **kw)

    def test_each_kind_is_validated_for_coherence(self):
        two = [{"label": "a", "is_correct": True}, {"label": "b"}]
        self.bad(kind="single", choices=[{"label": "a", "is_correct": True}, {"label": "b", "is_correct": True}])   # 2 bonnes
        self.bad(kind="single", choices=[{"label": "a"}, {"label": "b"}])                                           # 0 bonne
        self.bad(kind="multiple", choices=[{"label": "a"}, {"label": "b"}])
        self.bad(kind="true_false", choices=two + [{"label": "c"}])
        self.bad(kind="ordering", choices=[{"label": "a", "correct_order": 1}, {"label": "b", "correct_order": 3}])  # trou
        self.bad(kind="text", accepted=["  "])
        A.add_question(self.quiz, self.k.teacher, prompt="ok", kind="single", choices=two)
        A.add_question(self.quiz, self.k.teacher, prompt="code", kind="code")
        self.assertEqual(list(self.quiz.questions.order_by("position").values_list("position", flat=True)), [1, 2])

    def test_only_course_staff_authors_quizzes(self):
        with self.assertRaises(PermissionDeniedError):
            A.create_quiz(self.k.course, make_user(), title="x")


class QuizGradingTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_course()
        t = self.k.teacher
        self.quiz = A.create_quiz(self.k.course, t, title="Complet", pass_percent=60, max_attempts=2)
        self.q = {
            "single": A.add_question(self.quiz, t, kind="single", prompt="s", points=2, choices=[{"label": "ok", "is_correct": True}, {"label": "ko"}]),
            "multiple": A.add_question(self.quiz, t, kind="multiple", prompt="m", points=2, choices=[{"label": "1", "is_correct": True}, {"label": "2", "is_correct": True}, {"label": "3"}]),
            "tf": A.add_question(self.quiz, t, kind="true_false", prompt="tf", choices=[{"label": "Vrai", "is_correct": True}, {"label": "Faux"}]),
            "text": A.add_question(self.quiz, t, kind="text", prompt="capitale du Cameroun ?", accepted=["Yaoundé"]),
            "ordering": A.add_question(self.quiz, t, kind="ordering", prompt="o", points=2, choices=[{"label": "A", "correct_order": 2}, {"label": "B", "correct_order": 1}, {"label": "C", "correct_order": 3}]),
        }
        self.quiz.is_published = True
        self.quiz.save()
        self.u = student(self.k)

    def ids(self, key, correct=True):
        ch = list(self.q[key].choices.order_by("position"))
        if key == "ordering":
            return [str(c.pk) for c in sorted(ch, key=lambda c: c.correct_order)] if correct else [str(c.pk) for c in ch]
        if key == "multiple":
            return [str(c.pk) for c in ch if c.is_correct] if correct else [str(ch[0].pk), str(ch[2].pk)]
        return [str(next(c for c in ch if c.is_correct == correct).pk)]

    def answers(self, correct=True):
        return {str(self.q["single"].pk): {"selected": self.ids("single", correct)}, str(self.q["multiple"].pk): {"selected": self.ids("multiple", correct)},
                str(self.q["tf"].pk): {"selected": self.ids("tf", correct)}, str(self.q["text"].pk): {"text": "  YAOUNDE " if correct else "Douala"},
                str(self.q["ordering"].pk): {"selected": self.ids("ordering", correct)}}

    def test_perfect_attempt_is_graded_automatically_accents_and_case_insensitive(self):
        att = A.submit_attempt(self.u, A.start_attempt(self.u, self.quiz.pk).pk, self.answers(True))
        self.assertEqual((att.status, att.score, att.max_score, att.passed), ("graded", Decimal(8), Decimal(8), True))
        self.assertTrue(OutboxEvent.objects.filter(event_type="QuizPassed").exists())

    def test_wrong_answers_score_zero_and_multiple_is_all_or_nothing(self):
        att = A.submit_attempt(self.u, A.start_attempt(self.u, self.quiz.pk).pk, self.answers(False))
        self.assertEqual((att.score, att.passed), (Decimal(0), False))
        self.assertFalse(OutboxEvent.objects.filter(event_type="QuizPassed").exists())

    def test_foreign_choice_ids_are_rejected(self):
        att = A.start_attempt(self.u, self.quiz.pk)
        other = self.ids("tf")[0]
        with self.assertRaises(DomainError) as cm:
            A.submit_attempt(self.u, att.pk, {str(self.q["single"].pk): {"selected": [other]}})
        self.assertEqual(cm.exception.code, "invalid_answer")

    def test_attempt_limit_reuse_of_open_attempt_and_double_submit(self):
        a1 = A.start_attempt(self.u, self.quiz.pk)
        self.assertEqual(A.start_attempt(self.u, self.quiz.pk).pk, a1.pk)  # tentative ouverte reprise, pas dupliquee
        A.submit_attempt(self.u, a1.pk, self.answers(False))
        with self.assertRaises(ConflictError):
            A.submit_attempt(self.u, a1.pk, self.answers(True))
        a2 = A.start_attempt(self.u, self.quiz.pk)
        A.submit_attempt(self.u, a2.pk, self.answers(False))
        with self.assertRaises(DomainError) as cm:
            A.start_attempt(self.u, self.quiz.pk)
        self.assertEqual(cm.exception.code, "attempts_exhausted")

    def test_time_limit_expired_attempt_scores_zero(self):
        self.quiz.time_limit_seconds = 60
        self.quiz.save()
        att = A.start_attempt(self.u, self.quiz.pk)
        QuizAttempt.objects.filter(pk=att.pk).update(started_at=timezone.now() - timedelta(minutes=10))
        res = A.submit_attempt(self.u, att.pk, self.answers(True))
        self.assertEqual((res.score, res.passed, res.status), (Decimal(0), False, "graded"))
        self.assertEqual(A.start_attempt(self.u, self.quiz.pk).attempt_no, 2)  # la tentative expiree est consommee

    def test_access_rules(self):
        with self.assertRaises(PermissionDeniedError):
            A.start_attempt(make_user(), self.quiz.pk)  # non inscrit
        self.quiz.is_published = False
        self.quiz.save()
        with self.assertRaises(DomainError):
            A.start_attempt(self.u, self.quiz.pk)
        self.assertTrue(A.start_attempt(self.k.teacher, self.quiz.pk))  # l'enseignant peut tester son quiz

    def test_quiz_on_a_paid_chapter_requires_payment(self):
        self.quiz.chapter = self.k.c3
        self.quiz.save()
        with self.assertRaises(PermissionDeniedError) as cm:
            A.start_attempt(self.u, self.quiz.pk)
        self.assertEqual(cm.exception.code, "payment_required")

    def test_code_answers_wait_for_manual_review_then_finalize(self):
        quiz = A.create_quiz(self.k.course, self.k.teacher, title="Code", pass_percent=50)
        qc = A.add_question(quiz, self.k.teacher, kind="code", prompt="ecris fizzbuzz", points=4)
        quiz.is_published = True
        quiz.save()
        att = A.submit_attempt(self.u, A.start_attempt(self.u, quiz.pk).pk, {str(qc.pk): {"text": "print('fizz')"}})
        self.assertEqual((att.status, att.passed), ("pending_review", False))
        with self.assertRaises(PermissionDeniedError):
            A.grade_code_answer(att.pk, qc.pk, self.u, correct=True)
        done = A.grade_code_answer(att.pk, qc.pk, self.k.teacher, correct=True)
        self.assertEqual((done.status, done.passed, done.score), ("graded", True, Decimal(4)))


class QuizConcurrencyTests(BaobabTransactionTestCase):
    def test_parallel_start_never_exceeds_the_attempt_limit(self):
        k = make_course()
        quiz = A.create_quiz(k.course, k.teacher, title="Once", max_attempts=1)
        A.add_question(quiz, k.teacher, kind="single", prompt="?", choices=[{"label": "a", "is_correct": True}, {"label": "b"}])
        quiz.is_published = True
        quiz.save()
        u = student(k)
        errors = []

        def worker():
            try:
                A.start_attempt(u, quiz.pk)
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker) for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(errors, [])
        self.assertEqual(QuizAttempt.objects.filter(quiz=quiz, user=u).count(), 1)


class AssignmentTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_course()
        self.t = self.k.teacher
        self.u, self.v = student(self.k), student(self.k)

    def test_individual_submission_attempts_lateness_and_validation(self):
        a = A.create_assignment(self.k.course, self.t, title="TP1", max_attempts=2, due_at=timezone.now() - timedelta(hours=1))
        s1 = A.submit_assignment(a.pk, self.u, text="mon rendu")
        self.assertEqual((s1.attempt_no, s1.is_late), (1, True))
        A.submit_assignment(a.pk, self.u, attachments=[{"storage_key": "k", "filename": "a.zip", "size_bytes": 10}])
        with self.assertRaises(DomainError) as cm:
            A.submit_assignment(a.pk, self.u, text="trop")
        self.assertEqual(cm.exception.code, "attempts_exhausted")
        with self.assertRaises(DomainError):
            A.submit_assignment(a.pk, self.v, text="  ")
        strict = A.create_assignment(self.k.course, self.t, title="TP2", allow_late=False, due_at=timezone.now() - timedelta(minutes=1))
        with self.assertRaises(DomainError) as cm:
            A.submit_assignment(strict.pk, self.v, text="tard")
        self.assertEqual(cm.exception.code, "deadline_passed")
        with self.assertRaises(PermissionDeniedError):
            A.submit_assignment(a.pk, make_user(), text="intrus")

    def test_rubric_total_must_match(self):
        with self.assertRaises(DomainError):
            A.create_assignment(self.k.course, self.t, title="x", max_points=20, criteria=[{"label": "a", "max_points": 5}])

    def test_grading_rubric_bounds_regrade_and_permissions_with_notification(self):
        a = A.create_assignment(self.k.course, self.t, title="TP", max_points=20, criteria=[{"label": "Code", "max_points": 12}, {"label": "Tests", "max_points": 8}])
        sub = A.submit_assignment(a.pk, self.u, text="rendu")
        c1, c2 = list(a.criteria.order_by("position"))
        with self.assertRaises(PermissionDeniedError):
            A.grade_submission(sub.pk, self.v, points=10)
        with self.assertRaises(DomainError) as cm:
            A.grade_submission(sub.pk, self.t, criteria=[{"criterion_id": c1.pk, "points": 13}, {"criterion_id": c2.pk, "points": 1}])
        self.assertEqual(cm.exception.code, "points_out_of_range")
        with self.assertRaises(DomainError) as cm:
            A.grade_submission(sub.pk, self.t, criteria=[{"criterion_id": c1.pk, "points": 5}])
        self.assertEqual(cm.exception.code, "rubric_incomplete")
        with self.assertRaises(DomainError):
            A.grade_submission(sub.pk, self.t)
        g = A.grade_submission(sub.pk, self.t, criteria=[{"criterion_id": c1.pk, "points": 10}, {"criterion_id": c2.pk, "points": 6, "comment": "manque des tests"}], feedback="Bien")
        self.assertEqual(g.points, Decimal(16))
        g2 = A.grade_submission(sub.pk, self.t, criteria=[{"criterion_id": c1.pk, "points": 12}, {"criterion_id": c2.pk, "points": 8}])
        self.assertEqual((g2.pk, g2.points, g2.criteria.count()), (g.pk, Decimal(20), 2))  # re-correction : meme note mise a jour
        sub.refresh_from_db()
        self.assertEqual(sub.status, "graded")
        outbox.relay_batch(100)
        self.assertEqual(Notification.objects.filter(recipient=self.u, type_id="assignment_graded").count(), 2)  # une par correction
        self.assertFalse(Notification.objects.filter(recipient=self.v, type_id="assignment_graded").exists())

    def test_simple_grade_bounds_and_feedback_permissions(self):
        a = A.create_assignment(self.k.course, self.t, title="TP", max_points=10)
        sub = A.submit_assignment(a.pk, self.u, text="r")
        with self.assertRaises(DomainError):
            A.grade_submission(sub.pk, self.t, points=11)
        A.grade_submission(sub.pk, self.t, points=7)
        A.add_feedback(sub.pk, self.u, "merci")
        A.add_feedback(sub.pk, self.t, "de rien")
        with self.assertRaises(PermissionDeniedError):
            A.add_feedback(sub.pk, self.v, "je me mele")
        with self.assertRaises(DomainError):
            A.add_feedback(sub.pk, self.u, "  ")

    def test_group_assignment_flow(self):
        a = A.create_assignment(self.k.course, self.t, title="Projet", is_group=True, max_points=10)
        with self.assertRaises(DomainError) as cm:
            A.submit_assignment(a.pk, self.u, text="seul")
        self.assertEqual(cm.exception.code, "group_required")
        with self.assertRaises(DomainError):
            A.create_group(A.create_assignment(self.k.course, self.t, title="Indiv").pk, self.u, [self.v], "G")  # devoir individuel
        g = A.create_group(a.pk, self.u, [self.v], "Equipe A")
        with self.assertRaises(ConflictError):
            A.create_group(a.pk, self.v, [], "Equipe B")  # v est deja dans un groupe pour ce devoir
        with self.assertRaises(PermissionDeniedError):
            A.create_group(a.pk, make_user(), [], "Intrus")  # non inscrit
        sub = A.submit_assignment(a.pk, self.v, text="rendu commun")
        self.assertEqual((sub.group_id, sub.user_id, sub.submitted_by_id), (g.pk, None, self.v.pk))
        with self.assertRaises(DomainError):
            A.submit_assignment(a.pk, self.u, text="2e rendu")  # 1 tentative pour le GROUPE entier
        A.grade_submission(sub.pk, self.t, points=9)
        outbox.relay_batch(100)
        self.assertEqual(Notification.objects.filter(type_id="assignment_graded").count(), 2)  # les deux membres sont notifies
