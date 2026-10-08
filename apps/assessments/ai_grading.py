"""Correction automatique d'un rendu par Gemini. Ecrit une `Grade` (source='ai') que l'enseignant peut toujours remplacer."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.assessments import gemini
from apps.assessments.models import AssignmentSubmission, Grade, GradeCriterion
from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.exceptions import ConflictError, DomainError, ExternalServiceError, RateLimitedError
from apps.core.outbox import publish_event

log = logging.getLogger(__name__)


def _student_ids(sub: AssignmentSubmission) -> list:
    return [sub.user_id] if sub.user_id else list(sub.group.members.values_list("user_id", flat=True))


def _mark(sub_id, status: str, error: str = "") -> None:
    AssignmentSubmission.objects.filter(pk=sub_id).update(ai_status=status, ai_error=error)


def _reserve_quota() -> None:
    """Plafond GLOBAL par jour : protege le quota gratuit de Gemini contre un emballement (ou un abus)."""
    ok, _ = R.capped_incr(K.ai_grading_daily(timezone.now().strftime("%Y-%m-%d")), settings.AI_GRADING_DAILY_LIMIT, 90000)
    if not ok:
        raise RateLimitedError("Limite quotidienne de corrections automatiques atteinte : reessayez demain ou corrigez a la main.", code="ai_grading_daily_limit")


def grade_with_ai(submission_id, *, force: bool = False, http=None) -> Grade | None:
    """Corrige un rendu. Retourne None si rien a faire (devoir non automatique, ou deja note par un enseignant).
    Leve ExternalServiceError / RateLimitedError / DomainError en cas d'echec (le statut ai_status passe alors a 'failed')."""
    sub = AssignmentSubmission.objects.select_related("assignment", "group").get(pk=submission_id)
    a = sub.assignment
    if not a.auto_grade:
        if force:
            raise DomainError("La correction automatique n'est pas activee pour ce devoir.", code="auto_grade_disabled")
        return None
    existing = Grade.objects.filter(submission=sub).first()
    if existing and existing.source == "teacher":
        return None  # une note d'enseignant n'est JAMAIS ecrasee par l'IA
    if existing and not force:
        return existing
    if not sub.text.strip():
        _mark(sub.pk, "failed", "no_text")
        raise DomainError("Le rendu ne contient pas de texte a corriger (les fichiers joints ne sont pas lus par l'IA).", code="nothing_to_grade")
    crit = [{"id": c.pk, "label": c.label, "max_points": c.max_points} for c in a.criteria.order_by("position")]
    _mark(sub.pk, "pending")
    try:
        _reserve_quota()
        kwargs = {"http": http} if http else {}
        res = gemini.grade(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL, instructions=a.instructions, reference_answer=a.reference_answer,
                           student_answer=sub.text, max_points=a.max_points, notes=a.grading_notes, criteria=crit or None, timeout=settings.GEMINI_TIMEOUT_SECONDS, **kwargs)
    except gemini.GeminiError as exc:
        _mark(sub.pk, "failed", exc.code)
        raise ExternalServiceError(str(exc), code=exc.code) from exc
    except RateLimitedError:
        _mark(sub.pk, "failed", "daily_limit")
        raise
    return _save(sub, a, res, crit)


@transaction.atomic
def _save(sub: AssignmentSubmission, a, res: dict, crit: list[dict]) -> Grade:
    sub = AssignmentSubmission.objects.select_for_update(of=("self",)).select_related("group").get(pk=sub.pk)
    current = Grade.objects.filter(submission=sub).first()
    if current and current.source == "teacher":  # un enseignant a note pendant l'appel : il gagne
        AssignmentSubmission.objects.filter(pk=sub.pk).update(ai_status="none", ai_error="")
        return current
    grade, _ = Grade.objects.update_or_create(submission=sub, defaults={
        "grader": None, "points": res["points"], "feedback": res["feedback"], "graded_at": timezone.now(),
        "source": "ai", "ai_model": settings.GEMINI_MODEL[:60], "ai_confidence": res["confidence"]})
    grade.criteria.all().delete()
    if res["criteria"]:
        GradeCriterion.objects.bulk_create([GradeCriterion(grade=grade, criterion_id=crit[r["index"] - 1]["id"], points=r["points"], comment=r["comment"]) for r in res["criteria"]])
    AssignmentSubmission.objects.filter(pk=sub.pk).update(status="graded", ai_status="done", ai_error="")
    publish_event("SubmissionGraded", "submission", sub.pk, {"students": [str(i) for i in _student_ids(sub)], "grader": None, "points": str(res["points"]), "assignment": str(a.pk)})
    return grade


def conflict_if_busy(sub: AssignmentSubmission) -> None:
    if sub.ai_status == "pending":
        raise ConflictError("Une correction automatique est deja en cours pour ce rendu.", code="ai_grading_in_progress")
