"""Decision d'acces a un chapitre. UNE fonction, une raison explicite a chaque refus (l'API peut dire quoi faire : s'inscrire, payer...).
La partie 'paiement' est calculee par la fonction SQL baobab_chapter_unlocked (une seule definition de la regle)."""
from __future__ import annotations

from dataclasses import dataclass

from django.db import connection
from django.db.models import Q
from django.utils import timezone

from apps.education.models import Chapter, ClassroomMember, Course, CourseInstructor, Enrollment, Entitlement

STAFF_ROLES = (ClassroomMember.Role.OWNER, ClassroomMember.Role.INSTRUCTOR)


@dataclass(frozen=True)
class AccessDecision:
    allowed: bool
    reason: str  # ok | not_published | membership_required | classroom_payment_required | enroll_required | payment_required

    def __bool__(self) -> bool:
        return self.allowed


def is_course_staff(user, course: Course) -> bool:
    if not getattr(user, "pk", None):
        return False
    if user.is_staff:
        return True
    return (
        ClassroomMember.objects.filter(classroom_id=course.classroom_id, user=user, status="active", role__in=STAFF_ROLES).exists()
        or CourseInstructor.objects.filter(course=course, user=user).exists()
    )


def has_classroom_entitlement(user, classroom_id) -> bool:
    return Entitlement.objects.filter(user=user, scope="classroom", classroom_id=classroom_id, revoked_at__isnull=True).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).exists()


def chapter_payment_unlocked(user_id, chapter_id) -> bool:
    with connection.cursor() as cur:
        cur.execute("SELECT baobab_chapter_unlocked(%s, %s)", [user_id, chapter_id])
        return bool(cur.fetchone()[0])


def access_decision(user, chapter: Chapter) -> AccessDecision:
    module = chapter.module
    course = module.course
    classroom = course.classroom
    if is_course_staff(user, course):
        return AccessDecision(True, "ok")  # le personnel enseignant voit aussi les brouillons
    if not (chapter.is_published and module.is_published and course.status == Course.Status.PUBLISHED):
        return AccessDecision(False, "not_published")
    anonymous = not getattr(user, "pk", None)
    member = None if anonymous else ClassroomMember.objects.filter(classroom=classroom, user=user, status="active").first()
    if classroom.privacy != "public" and member is None:
        return AccessDecision(False, "membership_required")
    if chapter.is_free and classroom.privacy == "public" and not classroom.is_paid:
        return AccessDecision(True, "ok")  # apercu public : gratuit, classroom publique et gratuite, inscription non requise
    if anonymous:
        return AccessDecision(False, "enroll_required")
    if classroom.is_paid and not has_classroom_entitlement(user, classroom.pk):
        return AccessDecision(False, "classroom_payment_required")
    if not Enrollment.objects.filter(course=course, user=user, status__in=["active", "completed"]).exists():
        return AccessDecision(False, "enroll_required")
    if not chapter_payment_unlocked(user.pk, chapter.pk):
        return AccessDecision(False, "payment_required")
    return AccessDecision(True, "ok")
