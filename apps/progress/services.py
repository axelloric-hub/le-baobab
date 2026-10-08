from __future__ import annotations

import secrets

from django.db import IntegrityError, connection, transaction
from django.db.models import Avg
from django.utils import timezone

from apps.core import redis as R
from apps.core.exceptions import DomainError, PaymentRequiredError, PermissionDeniedError, RateLimitedError
from apps.core.outbox import publish_event
from apps.education.access import access_decision
from apps.education.models import Chapter, Course, Enrollment
from apps.progress.models import Certificate, CertificateTemplate, CertificateVerification, ChapterProgress

MAX_SECONDS_PER_CALL = 3600  # anti-abus : un client ne peut pas declarer 10 h d'etude en un appel
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sans caracteres ambigus (0/O, 1/I)


def course_progress(user, course) -> dict:
    with connection.cursor() as cur:
        cur.execute("SELECT total_chapters, completed_chapters, percent, time_spent_seconds FROM baobab_course_progress(%s, %s)", [user.pk, course.pk])
        total, done, pct, secs = cur.fetchone()
    return {"total_chapters": total, "completed_chapters": done, "percent": float(pct), "time_spent_seconds": int(secs)}


def module_progress(user, module) -> dict:
    with connection.cursor() as cur:
        cur.execute("SELECT total_chapters, completed_chapters, percent, time_spent_seconds FROM baobab_module_progress(%s, %s)", [user.pk, module.pk])
        total, done, pct, secs = cur.fetchone()
    return {"total_chapters": total, "completed_chapters": done, "percent": float(pct), "time_spent_seconds": int(secs)}


@transaction.atomic
def record_progress(user, chapter_id, *, percent: int, seconds: int = 0) -> ChapterProgress:
    """Monotone : le pourcentage ne recule jamais, le temps ne fait que s'accumuler. Exige l'acces au chapitre."""
    chapter = Chapter.objects.select_related("module__course__classroom").get(pk=chapter_id)
    decision = access_decision(user, chapter)
    if not decision:
        raise (PaymentRequiredError if decision.reason in ("payment_required", "classroom_payment_required") else PermissionDeniedError)("Acces au chapitre refuse.", code=decision.reason)
    if not 0 <= percent <= 100 or seconds < 0:
        raise DomainError("Valeurs de progression invalides.", code="invalid_progress")
    seconds = min(seconds, MAX_SECONDS_PER_CALL)
    try:
        with transaction.atomic():
            cp, _ = ChapterProgress.objects.select_for_update().get_or_create(user=user, chapter=chapter)
    except IntegrityError:
        cp = ChapterProgress.objects.select_for_update().get(user=user, chapter=chapter)
    was_completed = cp.status == "completed"
    cp.percent = max(cp.percent, percent)
    cp.time_spent_seconds += seconds
    if cp.percent == 100 and not was_completed:
        cp.status, cp.completed_at = "completed", timezone.now()
    cp.save()
    if cp.status == "completed" and not was_completed:
        publish_event("ChapterCompleted", "chapter", chapter.pk, {"user": str(user.pk), "course": str(chapter.module.course_id)})
        _after_chapter_completed(user, chapter.module.course)
    return cp


def complete_chapter(user, chapter_id) -> ChapterProgress:
    return record_progress(user, chapter_id, percent=100)


def _after_chapter_completed(user, course: Course) -> None:
    if course_progress(user, course)["percent"] < 100:
        return
    updated = Enrollment.objects.filter(user=user, course=course, status="active").update(status="completed", completed_at=timezone.now())
    if updated:
        publish_event("CourseCompleted", "course", course.pk, {"user": str(user.pk)})
    try_issue_certificate(user, course)


def _all_quizzes_passed(user, course: Course) -> tuple[bool, float | None]:
    from apps.assessments.models import Quiz

    quizzes = list(Quiz.objects.filter(course=course, is_published=True))
    if not quizzes:
        return True, None
    scores = []
    with connection.cursor() as cur:
        for q in quizzes:
            cur.execute("SELECT baobab_quiz_best_percent(%s, %s)", [user.pk, q.pk])
            best = cur.fetchone()[0]
            if best is None or float(best) < q.pass_percent:
                return False, None
            scores.append(float(best))
    return True, round(sum(scores) / len(scores), 2)


def _new_code() -> str:
    return "BAO-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(12))


@transaction.atomic
def try_issue_certificate(user, course: Course) -> Certificate | None:
    """Emet le certificat si : option activee, cours termine, tous les quiz publies reussis. Idempotent (un certificat valide par cours)."""
    if not course.certificate_enabled:
        return None
    if not Enrollment.objects.filter(user=user, course=course, status="completed").exists():
        return None
    ok, score = _all_quizzes_passed(user, course)
    if not ok:
        return None
    existing = Certificate.objects.filter(user=user, course=course, revoked_at__isnull=True).first()
    if existing:
        return existing
    template = CertificateTemplate.objects.filter(is_active=True).order_by("name").first()
    for _ in range(5):  # collision de code : quasi impossible (32^12), mais arbitree par la base
        try:
            with transaction.atomic():
                cert = Certificate.objects.create(user=user, course=course, template=template, verification_code=_new_code(), score_percent=score)
            publish_event("CertificateIssued", "certificate", cert.pk, {"user": str(user.pk), "course": str(course.pk)})
            return cert
        except IntegrityError:
            existing = Certificate.objects.filter(user=user, course=course, revoked_at__isnull=True).first()
            if existing:
                return existing
    raise DomainError("Impossible de generer un code de certificat.", code="code_generation_failed")


def verify_certificate(code: str, ip: str | None = None) -> dict:
    """Verification PUBLIQUE : ne renvoie ni e-mail ni identifiant interne. Limitee par IP (anti devinette de codes)."""
    if ip:
        allowed, _, _ = R.rate_limit("cert_verify", ip, 30, 60)
        if not allowed:
            raise RateLimitedError("Trop de verifications, reessayez plus tard.")
    cert = Certificate.objects.select_related("user__profile", "course").filter(verification_code=code.strip().upper()).first()
    if cert is None:
        return {"valid": False}
    CertificateVerification.objects.create(certificate=cert, ip_address=ip)
    if cert.revoked_at:
        return {"valid": False, "revoked": True}
    return {"valid": True, "holder": cert.user.profile.display_name, "course": cert.course.title, "issued_at": cert.issued_at.date().isoformat(),
            "score_percent": float(cert.score_percent) if cert.score_percent is not None else None}


@transaction.atomic
def revoke_certificate(certificate_id, *, by, reason: str) -> Certificate:
    if not by.is_staff:
        raise PermissionDeniedError("Reserve a l'administration.")
    cert = Certificate.objects.select_for_update().get(pk=certificate_id)
    cert.revoked_at, cert.revocation_reason = timezone.now(), reason[:300]
    cert.save(update_fields=["revoked_at", "revocation_reason"])
    return cert
