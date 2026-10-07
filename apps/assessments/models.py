"""Quiz (correction automatique) et devoirs (correction manuelle, individuels ou en groupe, plusieurs tentatives, grille de notation).
Les bonnes reponses ne sortent JAMAIS par les serializers de lecture : seul le service de correction les lit."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class Quiz(UUIDModel):
    course = models.ForeignKey("education.Course", on_delete=models.CASCADE, related_name="quizzes")
    chapter = models.ForeignKey("education.Chapter", null=True, blank=True, on_delete=models.SET_NULL, related_name="quizzes")
    title = models.CharField(max_length=160)
    pass_percent = models.PositiveSmallIntegerField(default=60)
    max_attempts = models.PositiveSmallIntegerField(default=3)  # 0 = illimite
    time_limit_seconds = models.PositiveIntegerField(null=True, blank=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "assessments_quiz"
        verbose_name_plural = "quizzes"
        constraints = [models.CheckConstraint(condition=Q(pass_percent__gte=0, pass_percent__lte=100), name="chk_quiz_pass_percent")]


class Question(UUIDModel):
    class Kind(models.TextChoices):
        SINGLE = "single", "Choix unique"
        MULTIPLE = "multiple", "Choix multiple"
        TRUE_FALSE = "true_false", "Vrai/Faux"
        TEXT = "text", "Texte (reponse exacte normalisee)"
        CODE = "code", "Code (correction manuelle)"
        ORDERING = "ordering", "Mise en ordre"

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    position = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=10, choices=Kind.choices)
    prompt = models.TextField()
    points = models.PositiveSmallIntegerField(default=1)
    explanation = models.TextField(blank=True)
    # SECRET cote serveur : {"accepted": ["reponse", ...]} pour TEXT. Jamais serialise vers le client.
    answer_key = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "assessments_question"
        constraints = [models.UniqueConstraint(fields=["quiz", "position"], name="uniq_question_position", deferrable=models.Deferrable.DEFERRED),
                       models.CheckConstraint(condition=Q(points__gt=0), name="chk_question_points")]


class Choice(UUIDModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    position = models.PositiveSmallIntegerField()  # pour ORDERING : position correcte = `correct_order`
    label = models.CharField(max_length=300)
    is_correct = models.BooleanField(default=False)
    correct_order = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = "assessments_choice"
        constraints = [models.UniqueConstraint(fields=["question", "position"], name="uniq_choice_position", deferrable=models.Deferrable.DEFERRED)]


class QuizAttempt(UUIDModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "En cours"
        GRADED = "graded", "Corrige"
        PENDING_REVIEW = "pending_review", "En attente de correction manuelle"

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="quiz_attempts")
    attempt_no = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(default=timezone.now, editable=False)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    max_score = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    passed = models.BooleanField(default=False)

    class Meta:
        db_table = "assessments_quiz_attempt"
        constraints = [models.UniqueConstraint(fields=["quiz", "user", "attempt_no"], name="uniq_quiz_attempt"),  # pas de double tentative concurrente
                       models.CheckConstraint(condition=Q(score__gte=0) & Q(score__lte=models.F("max_score")) | Q(max_score=0, score=0), name="chk_attempt_score_range")]
        indexes = [models.Index(fields=["user", "quiz", "-submitted_at"], name="attempt_user_quiz_idx")]


class AttemptAnswer(UUIDModel):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="+")
    selected = models.JSONField(default=list, blank=True)  # liste d'ids de choix (ou ordre)
    text = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True)  # NULL = en attente de correction manuelle
    points_awarded = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        db_table = "assessments_attempt_answer"
        constraints = [models.UniqueConstraint(fields=["attempt", "question"], name="uniq_attempt_answer")]


class Assignment(UUIDModel):
    course = models.ForeignKey("education.Course", on_delete=models.CASCADE, related_name="assignments")
    chapter = models.ForeignKey("education.Chapter", null=True, blank=True, on_delete=models.SET_NULL, related_name="assignments")
    title = models.CharField(max_length=160)
    instructions = models.TextField(blank=True)
    max_points = models.PositiveSmallIntegerField(default=20)
    due_at = models.DateTimeField(null=True, blank=True)
    allow_late = models.BooleanField(default=True)
    max_attempts = models.PositiveSmallIntegerField(default=1)
    is_group = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "assessments_assignment"
        constraints = [models.CheckConstraint(condition=Q(max_points__gt=0), name="chk_assignment_points"),
                       models.CheckConstraint(condition=Q(max_attempts__gt=0), name="chk_assignment_attempts")]


class RubricCriterion(UUIDModel):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="criteria")
    position = models.PositiveSmallIntegerField()
    label = models.CharField(max_length=200)
    max_points = models.PositiveSmallIntegerField()

    class Meta:
        db_table = "assessments_rubric_criterion"
        constraints = [models.UniqueConstraint(fields=["assignment", "position"], name="uniq_criterion_position"),
                       models.CheckConstraint(condition=Q(max_points__gt=0), name="chk_criterion_points")]


class AssignmentGroup(UUIDModel):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="groups")
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "assessments_assignment_group"
        constraints = [models.UniqueConstraint(fields=["assignment", "name"], name="uniq_agroup_name")]


class AssignmentGroupMember(models.Model):
    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(AssignmentGroup, on_delete=models.CASCADE, related_name="members")
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="+")  # denormalise : garantit 1 groupe/eleve/devoir
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="assignment_groups")

    class Meta:
        db_table = "assessments_assignment_group_member"
        constraints = [models.UniqueConstraint(fields=["assignment", "user"], name="uniq_one_group_per_assignment")]


class AssignmentSubmission(UUIDModel):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Rendu"
        GRADED = "graded", "Note"

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    user = models.ForeignKey(U, null=True, blank=True, on_delete=models.CASCADE, related_name="submissions")  # individuel
    group = models.ForeignKey(AssignmentGroup, null=True, blank=True, on_delete=models.CASCADE, related_name="submissions")  # groupe
    submitted_by = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    attempt_no = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SUBMITTED)
    text = models.TextField(blank=True)
    attachments = models.JSONField(default=list, blank=True)  # [{"storage_key","filename","size_bytes"}]
    is_late = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "assessments_submission"
        constraints = [
            models.CheckConstraint(condition=Q(user__isnull=False, group__isnull=True) | Q(user__isnull=True, group__isnull=False), name="chk_submission_owner"),
            models.UniqueConstraint(fields=["assignment", "user", "attempt_no"], condition=Q(user__isnull=False), name="uniq_submission_user_attempt"),
            models.UniqueConstraint(fields=["assignment", "group", "attempt_no"], condition=Q(group__isnull=False), name="uniq_submission_group_attempt"),
        ]
        indexes = [models.Index(fields=["assignment", "-submitted_at"], name="submission_assignment_idx")]


class Grade(UUIDModel):
    submission = models.OneToOneField(AssignmentSubmission, on_delete=models.CASCADE, related_name="grade")
    grader = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="grades_given")
    points = models.DecimalField(max_digits=6, decimal_places=2)
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "assessments_grade"
        constraints = [models.CheckConstraint(condition=Q(points__gte=0), name="chk_grade_points")]


class GradeCriterion(models.Model):
    id = models.BigAutoField(primary_key=True)
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="criteria")
    criterion = models.ForeignKey(RubricCriterion, on_delete=models.CASCADE, related_name="+")
    points = models.DecimalField(max_digits=6, decimal_places=2)
    comment = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "assessments_grade_criterion"
        constraints = [models.UniqueConstraint(fields=["grade", "criterion"], name="uniq_grade_criterion")]


class Feedback(UUIDModel):
    """Fil de commentaires sur un rendu (en plus de la note)."""

    submission = models.ForeignKey(AssignmentSubmission, on_delete=models.CASCADE, related_name="feedback")
    author = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "assessments_feedback"
        indexes = [models.Index(fields=["submission", "created_at"], name="feedback_submission_idx")]
