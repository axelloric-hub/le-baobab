from __future__ import annotations

from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.audit.services import record as audit_record
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.moderation import registry
from apps.moderation.models import (
    ContentViolation, ModerationAction, ModerationCase, Report, ReportReason, UserRestriction,
)

STRIKE_SUSPENSION_THRESHOLD = 5
STRIKE_WINDOW_DAYS = 180


@transaction.atomic
def report_content(*, reporter, target_type: str, target_id, reason_code: str, details: str = "") -> Report:
    hooks = registry.get(target_type)
    if hooks is None:
        raise DomainError("Type de contenu non signalable.", code="unknown_target_type")
    reason = ReportReason.objects.get(pk=reason_code, is_active=True)
    owner_id = hooks.owner_of(target_id)
    if owner_id is None:
        raise DomainError("Contenu introuvable.", code="not_found")
    if str(owner_id) == str(reporter.pk):
        raise DomainError("Vous ne pouvez pas signaler votre propre contenu.", code="self_report")
    case = ModerationCase.objects.select_for_update().filter(subject_type=target_type, subject_id=target_id, status__in=["open", "in_review"]).first()
    if case is None:
        try:
            with transaction.atomic():
                case = ModerationCase.objects.create(subject_type=target_type, subject_id=target_id, subject_user_id=owner_id, priority=reason.severity)
        except IntegrityError:
            case = ModerationCase.objects.get(subject_type=target_type, subject_id=target_id, status__in=["open", "in_review"])
    elif reason.severity > case.priority:
        case.priority = reason.severity
        case.save(update_fields=["priority"])
    try:
        with transaction.atomic():
            report = Report.objects.create(reporter=reporter, target_type=target_type, target_id=target_id, target_user_id=owner_id,
                                           reason=reason, details=details, case=case)
    except IntegrityError as exc:
        raise ConflictError("Vous avez deja signale ce contenu.", code="already_reported") from exc
    publish_event("ContentReported", "report", report.pk, {"target_type": target_type, "target_id": str(target_id)})
    return report


@transaction.atomic
def apply_action(*, moderator, case: ModerationCase, action: str, reason: str, expires_at: datetime | None = None, policy_code: str = "", points: int = 1) -> ModerationAction:
    """Applique une decision : effet sur la cible (via hooks), trace immuable, sanction, strikes, cloture du dossier."""
    if not (moderator.is_staff or moderator.has_perm("moderation.change_moderationcase")):
        raise PermissionDeniedError("Droits de moderation requis.")
    case = ModerationCase.objects.select_for_update().get(pk=case.pk)
    if case.status in ("resolved", "dismissed"):
        raise ConflictError("Dossier deja clos.", code="case_closed")
    hooks = registry.get(case.subject_type)
    T = ModerationAction.Type
    if action in (T.HIDE, T.REMOVE, T.RESTORE):
        if hooks is None:
            raise DomainError("Aucun hook pour ce type.", code="no_hooks")
        {T.HIDE: hooks.hide, T.REMOVE: hooks.remove, T.RESTORE: hooks.restore}[action](case.subject_id)
    act = ModerationAction.objects.create(case=case, moderator=moderator, action=action, target_type=case.subject_type, target_id=case.subject_id,
                                          target_user=case.subject_user, reason=reason, expires_at=expires_at)
    if action in (T.WARNING, T.SUSPEND, T.BAN) and case.subject_user_id:
        _sanction(act, case, action, reason, expires_at, policy_code, points)
    case.status = ModerationCase.Status.DISMISSED if action == T.DISMISS else ModerationCase.Status.RESOLVED
    case.resolved_at, case.resolution = timezone.now(), f"{action}: {reason}"[:500]
    case.save(update_fields=["status", "resolved_at", "resolution"])
    case.reports.filter(status=Report.Status.OPEN).update(status=Report.Status.DISMISSED if action == T.DISMISS else Report.Status.ACTIONED)
    audit_record(actor=moderator, action=f"moderation.{action}", object_type=case.subject_type, object_id=case.subject_id, new={"case": str(case.pk), "reason": reason})
    publish_event("ModerationActionApplied", "moderation_action", act.pk, {"action": action, "target_type": case.subject_type})
    return act


def _sanction(act: ModerationAction, case: ModerationCase, action: str, reason: str, expires_at, policy_code: str, points: int) -> None:
    from apps.accounts.models import User
    from apps.accounts.services import suspend_user

    user = User.objects.get(pk=case.subject_user_id)
    kind = {"warning": UserRestriction.Kind.WARNING, "suspend": UserRestriction.Kind.SUSPENSION, "ban": UserRestriction.Kind.BAN}[action]
    _new_restriction(user, kind, act, reason, expires_at if action != "ban" else None)
    if action in ("suspend", "ban"):
        suspend_user(user=user, reason=reason, until=expires_at if action == "suspend" else None)
    ContentViolation.objects.create(user=user, action=act, policy_code=policy_code or "unspecified", points=points,
                                    expires_at=timezone.now() + timedelta(days=STRIKE_WINDOW_DAYS))
    total = ContentViolation.objects.filter(user=user, expires_at__gt=timezone.now()).aggregate(t=Sum("points"))["t"] or 0
    if action == "warning" and total >= STRIKE_SUSPENSION_THRESHOLD:
        until = timezone.now() + timedelta(days=7)
        _new_restriction(user, UserRestriction.Kind.SUSPENSION, act, "Seuil de strikes atteint", until)
        suspend_user(user=user, reason="Seuil de strikes atteint", until=until)


def active_restrictions(user_id, kind: str | None = None):
    now = timezone.now()
    qs = UserRestriction.objects.filter(user_id=user_id, revoked_at__isnull=True, starts_at__lte=now).filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now))
    return qs.filter(kind=kind) if kind else qs


def _new_restriction(user, kind: str, act: ModerationAction, reason: str, ends_at) -> UserRestriction:
    """La base interdit (contrainte d'exclusion) deux suspensions/bans actifs qui se chevauchent : la nouvelle sanction
    REMPLACE l'ancienne (revoquee, historique conserve) au lieu de provoquer une erreur."""
    if kind in (UserRestriction.Kind.SUSPENSION, UserRestriction.Kind.BAN):
        UserRestriction.objects.filter(user=user, kind__in=[UserRestriction.Kind.SUSPENSION, UserRestriction.Kind.BAN], revoked_at__isnull=True).update(revoked_at=timezone.now())
    return UserRestriction.objects.create(user=user, kind=kind, action=act, reason=reason, ends_at=ends_at)
