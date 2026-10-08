"""Declenche la correction automatique des qu'un rendu est depose (evenement AssignmentSubmitted)."""
import logging

from apps.assessments import ai_grading
from apps.core.exceptions import DomainError
from apps.core.outbox import subscribe

log = logging.getLogger(__name__)


@subscribe("AssignmentSubmitted")
def grade_automatically(ev):
    """Un echec (quota, reseau, cle absente) ne doit PAS faire boucler l'outbox : le statut `ai_status='failed'` est visible et
    l'enseignant peut relancer (POST /submissions/{id}/auto-grade/) ou noter a la main."""
    try:
        ai_grading.grade_with_ai(ev.aggregate_id)
    except DomainError as exc:  # inclut ExternalServiceError et RateLimitedError
        log.warning("auto-correction ignoree submission=%s code=%s", ev.aggregate_id, getattr(exc, "code", "?"))
