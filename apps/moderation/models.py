"""Moderation. Cible GENERIQUE (target_type + target_id) : la moderation ne connait aucun autre domaine ;
chaque domaine enregistre ses hooks (moderation.registry) -> frontieres respectees, extractible en service.
ModerationAction fait office de ModerationLog : IMMUABLE (trigger SQL), donc audit complet par construction.
Warning/Ban/Suspension = UserRestriction(kind=...) : un seul modele de sanction."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class ReportReason(models.Model):
    code = models.CharField(max_length=40, primary_key=True)  # spam, harassment, hate, nudity, violence, scam, copyright, other
    label = models.CharField(max_length=120)
    severity = models.PositiveSmallIntegerField(default=1)  # 1..5, pondere la priorite du dossier
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "moderation_report_reason"
        constraints = [models.CheckConstraint(condition=Q(severity__gte=1, severity__lte=5), name="chk_reason_severity")]

    def __str__(self) -> str:
        return self.label


class ModerationCase(UUIDModel):
    class Status(models.TextChoices):
        OPEN = "open", "Ouvert"
        IN_REVIEW = "in_review", "En cours"
        RESOLVED = "resolved", "Resolu"
        DISMISSED = "dismissed", "Classe sans suite"

    subject_type = models.CharField(max_length=40)
    subject_id = models.UUIDField()
    subject_user = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="moderation_cases")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    priority = models.PositiveSmallIntegerField(default=1)
    assignee = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_cases")
    opened_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "moderation_case"
        constraints = [
            # UN dossier ouvert par objet : les nouveaux signalements s'y rattachent.
            models.UniqueConstraint(fields=["subject_type", "subject_id"], condition=Q(status__in=["open", "in_review"]), name="uniq_case_open_subject"),
            models.CheckConstraint(condition=~Q(status__in=["resolved", "dismissed"]) | Q(resolved_at__isnull=False), name="chk_case_resolved_dated"),
        ]
        indexes = [models.Index(fields=["-priority", "opened_at"], name="case_queue_idx", condition=Q(status__in=["open", "in_review"])),
                   models.Index(fields=["assignee", "status"], name="case_assignee_idx")]


class Report(UUIDModel):
    class Status(models.TextChoices):
        OPEN = "open", "Ouvert"
        ACTIONED = "actioned", "Traite (action prise)"
        DISMISSED = "dismissed", "Rejete"

    reporter = models.ForeignKey(U, on_delete=models.CASCADE, related_name="reports_made")
    target_type = models.CharField(max_length=40)  # post, comment, message, user, group, product, ad...
    target_id = models.UUIDField()
    target_user = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="reports_received")
    reason = models.ForeignKey(ReportReason, on_delete=models.PROTECT, related_name="reports")
    details = models.CharField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    case = models.ForeignKey(ModerationCase, null=True, blank=True, on_delete=models.SET_NULL, related_name="reports")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "moderation_report"
        constraints = [models.UniqueConstraint(fields=["reporter", "target_type", "target_id"], condition=Q(status="open"), name="uniq_report_open_per_reporter")]
        indexes = [models.Index(fields=["target_type", "target_id"], name="report_target_idx"),
                   models.Index(fields=["status", "created_at"], name="report_open_idx", condition=Q(status="open"))]


class ModerationAction(UUIDModel):
    class Type(models.TextChoices):
        WARNING = "warning", "Avertissement"
        HIDE = "hide", "Masquer"
        REMOVE = "remove", "Supprimer"
        SUSPEND = "suspend", "Suspendre"
        BAN = "ban", "Bannir"
        RESTORE = "restore", "Restaurer"
        DISMISS = "dismiss", "Classer sans suite"

    case = models.ForeignKey(ModerationCase, null=True, on_delete=models.PROTECT, related_name="actions")
    moderator = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="moderation_actions")
    action = models.CharField(max_length=10, choices=Type.choices)
    target_type = models.CharField(max_length=40)
    target_id = models.UUIDField()
    target_user = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reason = models.CharField(max_length=1000)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "moderation_action"
        indexes = [models.Index(fields=["target_type", "target_id", "-created_at"], name="modaction_target_idx"),
                   models.Index(fields=["moderator", "-created_at"], name="modaction_moderator_idx")]


class ContentViolation(UUIDModel):
    """Systeme de strikes : cumul de points => escalade automatique decidee par la politique."""

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="violations")
    action = models.ForeignKey(ModerationAction, on_delete=models.PROTECT, related_name="violations")
    policy_code = models.CharField(max_length=40)
    points = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    expires_at = models.DateTimeField(null=True, blank=True)  # les strikes vieillissent

    class Meta:
        db_table = "moderation_violation"
        indexes = [models.Index(fields=["user", "-created_at"], name="violation_user_idx")]


class UserRestriction(UUIDModel):
    class Kind(models.TextChoices):
        WARNING = "warning", "Avertissement"
        POSTING_BAN = "posting_ban", "Interdiction de publier"
        MESSAGING_BAN = "messaging_ban", "Interdiction de messagerie"
        SUSPENSION = "suspension", "Suspension"
        BAN = "ban", "Bannissement"

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="restrictions")
    kind = models.CharField(max_length=14, choices=Kind.choices)
    action = models.ForeignKey(ModerationAction, null=True, on_delete=models.SET_NULL, related_name="restrictions")
    reason = models.CharField(max_length=1000)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)  # NULL = permanent
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        db_table = "moderation_restriction"
        constraints = [models.CheckConstraint(condition=Q(ends_at__isnull=True) | Q(ends_at__gt=models.F("starts_at")), name="chk_restriction_period")]
        indexes = [models.Index(fields=["user", "kind"], name="restriction_active_idx", condition=Q(revoked_at__isnull=True))]
