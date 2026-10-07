from __future__ import annotations

import unicodedata
from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.assessments.models import (
    Assignment, AssignmentGroup, AssignmentGroupMember, AssignmentSubmission, AttemptAnswer, Choice, Feedback, Grade, GradeCriterion, Question, Quiz,
    QuizAttempt, RubricCriterion,
)
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.education.access import access_decision, is_course_staff
from apps.education.models import Course, Enrollment

TIME_GRACE_SECONDS = 10


def _normalize(text: str) -> str:
    t = unicodedata.normalize("NFKD", text or "")
    return " ".join("".join(c for c in t if not unicodedata.combining(c)).casefold().split())


def _require_enrolled_or_staff(user, course: Course) -> None:
    if is_course_staff(user, course):
        return
    if not Enrollment.objects.filter(user=user, course=course, status__in=["active", "completed"]).exists():
        raise PermissionDeniedError("Inscription au cours requise.", code="enroll_required")


# ------------------------------------------------------------------ quiz : creation
@transaction.atomic
def create_quiz(course: Course, actor, *, title: str, pass_percent: int = 60, max_attempts: int = 3, time_limit_seconds: int | None = None, chapter=None) -> Quiz:
    if not is_course_staff(actor, course):
        raise PermissionDeniedError("Reserve aux enseignants du cours.")
    return Quiz.objects.create(course=course, chapter=chapter, title=title, pass_percent=pass_percent, max_attempts=max_attempts, time_limit_seconds=time_limit_seconds)


@transaction.atomic
def add_question(quiz: Quiz, actor, *, kind: str, prompt: str, points: int = 1, choices: list[dict] | None = None, accepted: list[str] | None = None, explanation: str = "") -> Question:
    """Valide la COHERENCE de la question selon son type avant ecriture."""
    if not is_course_staff(actor, quiz.course):
        raise PermissionDeniedError("Reserve aux enseignants du cours.")
    choices = choices or []
    K = Question.Kind
    correct = [c for c in choices if c.get("is_correct")]
    if kind == K.SINGLE and (len(choices) < 2 or len(correct) != 1):
        raise DomainError("Choix unique : au moins 2 choix et exactement 1 bonne reponse.", code="invalid_question")
    if kind == K.MULTIPLE and (len(choices) < 2 or not correct):
        raise DomainError("Choix multiple : au moins 2 choix et 1 bonne reponse.", code="invalid_question")
    if kind == K.TRUE_FALSE:
        if len(choices) != 2 or len(correct) != 1:
            raise DomainError("Vrai/Faux : exactement 2 choix dont 1 correct.", code="invalid_question")
    if kind == K.ORDERING:
        orders = sorted(c.get("correct_order") or 0 for c in choices)
        if len(choices) < 2 or orders != list(range(1, len(choices) + 1)):
            raise DomainError("Mise en ordre : ordres corrects 1..N sans trou.", code="invalid_question")
    if kind == K.TEXT and not [a for a in (accepted or []) if _normalize(a)]:
        raise DomainError("Question texte : au moins une reponse acceptee.", code="invalid_question")
    pos = (quiz.questions.aggregate(m=Max("position"))["m"] or 0) + 1
    q = Question.objects.create(quiz=quiz, position=pos, kind=kind, prompt=prompt, points=points, explanation=explanation,
                                answer_key={"accepted": accepted} if kind == K.TEXT else {})
    Choice.objects.bulk_create([Choice(question=q, position=i + 1, label=c["label"], is_correct=bool(c.get("is_correct")), correct_order=c.get("correct_order"))
                                for i, c in enumerate(choices)])
    return q


# ------------------------------------------------------------------ quiz : tentatives
def _quiz_access(user, quiz: Quiz) -> None:
    if not quiz.is_published and not is_course_staff(user, quiz.course):
        raise DomainError("Quiz non publie.", code="not_published")
    if quiz.chapter_id:
        decision = access_decision(user, quiz.chapter)
        if not decision:
            raise PermissionDeniedError("Acces au quiz refuse.", code=decision.reason)
    else:
        _require_enrolled_or_staff(user, quiz.course)


@transaction.atomic
def start_attempt(user, quiz_id) -> QuizAttempt:
    quiz = Quiz.objects.select_for_update(of=("self",)).select_related("course", "chapter__module__course__classroom").get(pk=quiz_id)  # verrou : pas de depassement concurrent du nombre de tentatives
    _quiz_access(user, quiz)
    open_attempt = QuizAttempt.objects.filter(quiz=quiz, user=user, status="in_progress").first()
    if open_attempt:
        limit_ok = not quiz.time_limit_seconds or timezone.now() <= open_attempt.started_at + timedelta(seconds=quiz.time_limit_seconds + TIME_GRACE_SECONDS)
        if limit_ok:
            return open_attempt
    used = QuizAttempt.objects.filter(quiz=quiz, user=user).count()
    if quiz.max_attempts and used >= quiz.max_attempts:
        raise DomainError("Nombre maximal de tentatives atteint.", code="attempts_exhausted")
    try:
        with transaction.atomic():
            return QuizAttempt.objects.create(quiz=quiz, user=user, attempt_no=used + 1)
    except IntegrityError as exc:
        raise ConflictError("Tentative deja en cours.", code="attempt_conflict") from exc


def _grade_answer(q: Question, selected: list, text: str) -> tuple[bool | None, Decimal]:
    K = Question.Kind
    pts = Decimal(q.points)
    choices = list(q.choices.all())
    if q.kind in (K.SINGLE, K.TRUE_FALSE):
        right = [str(c.pk) for c in choices if c.is_correct]
        ok = [str(s) for s in selected] == right
    elif q.kind == K.MULTIPLE:
        ok = {str(s) for s in selected} == {str(c.pk) for c in choices if c.is_correct} and len(selected) == len(set(map(str, selected)))
    elif q.kind == K.ORDERING:
        ok = [str(s) for s in selected] == [str(c.pk) for c in sorted(choices, key=lambda c: c.correct_order or 0)]
    elif q.kind == K.TEXT:
        ok = _normalize(text) in {_normalize(a) for a in q.answer_key.get("accepted", [])}
    else:  # CODE : correction manuelle
        return None, Decimal(0)
    return ok, pts if ok else Decimal(0)


@transaction.atomic
def submit_attempt(user, attempt_id, answers: dict) -> QuizAttempt:
    """answers = {question_id: {"selected": [choice_id...], "text": "..."}}. Hors delai : note 0 (la tentative est consommee)."""
    attempt = QuizAttempt.objects.select_for_update(of=("self",)).select_related("quiz__course").get(pk=attempt_id, user=user)
    if attempt.status != "in_progress":
        raise ConflictError("Tentative deja soumise.", code="already_submitted")
    quiz = attempt.quiz
    questions = list(quiz.questions.prefetch_related("choices"))
    now = timezone.now()
    attempt.submitted_at = now
    attempt.max_score = Decimal(sum(q.points for q in questions))
    if quiz.time_limit_seconds and now > attempt.started_at + timedelta(seconds=quiz.time_limit_seconds + TIME_GRACE_SECONDS):
        attempt.status, attempt.score, attempt.passed = "graded", Decimal(0), False
        attempt.save()
        return attempt
    valid_ids = {str(q.pk): {str(c.pk) for c in q.choices.all()} for q in questions}
    total, pending, rows = Decimal(0), False, []
    for q in questions:
        a = answers.get(str(q.pk), {})
        selected, text = list(a.get("selected", [])), a.get("text", "")
        if any(str(s) not in valid_ids[str(q.pk)] for s in selected):
            raise DomainError("Reponse invalide : choix inconnu pour cette question.", code="invalid_answer")
        ok, pts = _grade_answer(q, selected, text)
        pending = pending or ok is None
        total += pts
        rows.append(AttemptAnswer(attempt=attempt, question=q, selected=[str(s) for s in selected], text=text, is_correct=ok, points_awarded=pts))
    AttemptAnswer.objects.bulk_create(rows)
    attempt.score = total
    _finalize(attempt, pending)
    return attempt


def _finalize(attempt: QuizAttempt, pending: bool) -> None:
    attempt.status = "pending_review" if pending else "graded"
    pct = (attempt.score / attempt.max_score * 100) if attempt.max_score else Decimal(0)
    attempt.passed = (not pending) and pct >= attempt.quiz.pass_percent
    attempt.save()
    if attempt.passed:
        publish_event("QuizPassed", "quiz_attempt", attempt.pk, {"user": str(attempt.user_id), "course": str(attempt.quiz.course_id), "quiz": str(attempt.quiz_id)})


@transaction.atomic
def grade_code_answer(attempt_id, question_id, grader, *, correct: bool) -> QuizAttempt:
    attempt = QuizAttempt.objects.select_for_update(of=("self",)).select_related("quiz__course").get(pk=attempt_id)
    if not is_course_staff(grader, attempt.quiz.course):
        raise PermissionDeniedError("Reserve aux enseignants du cours.")
    ans = AttemptAnswer.objects.select_for_update(of=("self",)).select_related("question").get(attempt=attempt, question_id=question_id, is_correct__isnull=True)
    ans.is_correct = correct
    ans.points_awarded = Decimal(ans.question.points) if correct else Decimal(0)
    ans.save(update_fields=["is_correct", "points_awarded"])
    attempt.score += ans.points_awarded
    _finalize(attempt, pending=attempt.answers.filter(is_correct__isnull=True).exists())
    return attempt


# ------------------------------------------------------------------ devoirs
@transaction.atomic
def create_assignment(course: Course, actor, *, title: str, instructions: str = "", max_points: int = 20, due_at=None, allow_late: bool = True,
                      max_attempts: int = 1, is_group: bool = False, criteria: list[dict] | None = None, chapter=None) -> Assignment:
    if not is_course_staff(actor, course):
        raise PermissionDeniedError("Reserve aux enseignants du cours.")
    criteria = criteria or []
    if criteria and sum(c["max_points"] for c in criteria) != max_points:
        raise DomainError("La somme des criteres doit egaler le total du devoir.", code="rubric_total_mismatch")
    a = Assignment.objects.create(course=course, chapter=chapter, title=title, instructions=instructions, max_points=max_points, due_at=due_at,
                                  allow_late=allow_late, max_attempts=max_attempts, is_group=is_group, is_published=True)
    RubricCriterion.objects.bulk_create([RubricCriterion(assignment=a, position=i + 1, label=c["label"], max_points=c["max_points"]) for i, c in enumerate(criteria)])
    return a


@transaction.atomic
def create_group(assignment_id, creator, member_users: list, name: str) -> AssignmentGroup:
    a = Assignment.objects.select_related("course").get(pk=assignment_id)
    if not a.is_group:
        raise DomainError("Ce devoir est individuel.", code="not_group_assignment")
    members = {creator.pk: creator, **{u.pk: u for u in member_users}}
    for u in members.values():
        _require_enrolled_or_staff(u, a.course)
    try:
        with transaction.atomic():
            g = AssignmentGroup.objects.create(assignment=a, name=name)
            AssignmentGroupMember.objects.bulk_create([AssignmentGroupMember(group=g, assignment=a, user=u) for u in members.values()])
    except IntegrityError as exc:
        raise ConflictError("Un membre appartient deja a un groupe de ce devoir (ou nom deja pris).", code="group_conflict") from exc
    return g


def _student_ids(sub: AssignmentSubmission) -> list:
    return [sub.user_id] if sub.user_id else list(sub.group.members.values_list("user_id", flat=True))


@transaction.atomic
def submit_assignment(assignment_id, user, *, text: str = "", attachments: list[dict] | None = None) -> AssignmentSubmission:
    a = Assignment.objects.select_for_update(of=("self",)).select_related("course").get(pk=assignment_id)  # verrou : numerotation fiable des tentatives
    if not a.is_published:
        raise DomainError("Devoir non publie.", code="not_published")
    _require_enrolled_or_staff(user, a.course)
    now = timezone.now()
    late = bool(a.due_at and now > a.due_at)
    if late and not a.allow_late:
        raise DomainError("Date limite depassee.", code="deadline_passed")
    if not text.strip() and not attachments:
        raise DomainError("Un rendu doit contenir du texte ou un fichier.", code="empty_submission")
    owner: dict
    if a.is_group:
        gm = AssignmentGroupMember.objects.filter(assignment=a, user=user).select_related("group").first()
        if gm is None:
            raise DomainError("Vous devez d'abord rejoindre un groupe.", code="group_required")
        owner = {"group": gm.group}
        used = AssignmentSubmission.objects.filter(assignment=a, group=gm.group).count()
    else:
        owner = {"user": user}
        used = AssignmentSubmission.objects.filter(assignment=a, user=user).count()
    if used >= a.max_attempts:
        raise DomainError("Nombre maximal de rendus atteint.", code="attempts_exhausted")
    try:
        with transaction.atomic():
            sub = AssignmentSubmission.objects.create(assignment=a, submitted_by=user, attempt_no=used + 1, text=text, attachments=attachments or [], is_late=late, **owner)
    except IntegrityError as exc:
        raise ConflictError("Rendu simultane detecte.", code="submission_conflict") from exc
    publish_event("AssignmentSubmitted", "submission", sub.pk, {"user": str(user.pk), "course": str(a.course_id)})
    return sub


@transaction.atomic
def grade_submission(submission_id, grader, *, points: Decimal | int | None = None, criteria: list[dict] | None = None, feedback: str = "") -> Grade:
    sub = AssignmentSubmission.objects.select_for_update(of=("self",)).select_related("assignment__course", "group").get(pk=submission_id)
    a = sub.assignment
    if not is_course_staff(grader, a.course):
        raise PermissionDeniedError("Reserve aux enseignants du cours.")
    rubric = {c.pk: c for c in a.criteria.all()}
    if criteria:
        seen = set()
        for c in criteria:
            crit = rubric.get(c["criterion_id"])
            if crit is None or c["criterion_id"] in seen:
                raise DomainError("Critere inconnu ou en double.", code="invalid_criterion")
            if not 0 <= Decimal(c["points"]) <= crit.max_points:
                raise DomainError(f"Points hors bornes pour « {crit.label} ».", code="points_out_of_range")
            seen.add(c["criterion_id"])
        if seen != set(rubric):
            raise DomainError("Tous les criteres de la grille doivent etre notes.", code="rubric_incomplete")
        points = sum(Decimal(c["points"]) for c in criteria)
    elif points is None:
        raise DomainError("Points ou criteres requis.", code="points_required")
    points = Decimal(points)
    if not 0 <= points <= a.max_points:
        raise DomainError("Note hors bornes.", code="points_out_of_range")
    grade, _ = Grade.objects.update_or_create(submission=sub, defaults={"grader": grader, "points": points, "feedback": feedback, "graded_at": timezone.now()})
    if criteria:
        grade.criteria.all().delete()
        GradeCriterion.objects.bulk_create([GradeCriterion(grade=grade, criterion_id=c["criterion_id"], points=Decimal(c["points"]), comment=c.get("comment", "")) for c in criteria])
    sub.status = "graded"
    sub.save(update_fields=["status"])
    publish_event("SubmissionGraded", "submission", sub.pk, {"students": [str(i) for i in _student_ids(sub)], "grader": str(grader.pk), "points": str(points), "assignment": str(a.pk)})
    return grade


@transaction.atomic
def add_feedback(submission_id, author, body: str) -> Feedback:
    sub = AssignmentSubmission.objects.select_related("assignment__course", "group").get(pk=submission_id)
    if not (is_course_staff(author, sub.assignment.course) or author.pk in _student_ids(sub)):
        raise PermissionDeniedError("Acces refuse.")
    if not body.strip():
        raise DomainError("Commentaire vide.", code="empty")
    return Feedback.objects.create(submission=sub, author=author, body=body)
