"""Cas d'usage du LMS. Toutes les ecritures sont atomiques ; les doublons sont arbitres par les contraintes UNIQUE."""
from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.utils import timezone

from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.education.access import STAFF_ROLES, has_classroom_entitlement, is_course_staff
from apps.education.models import (
    Chapter, Classroom, ClassroomInvitation, ClassroomMember, ContentBlock, Course, CourseInstructor, Enrollment, Entitlement, Module,
)

PRICE_ERROR = "Prix incoherent : un element gratuit n'a pas de prix ; un element payant exige un prix > 0 et une devise."


def _save(obj):
    try:
        with transaction.atomic():
            obj.save()
    except IntegrityError as exc:
        if "pricing" in str(exc):
            raise DomainError(PRICE_ERROR, code="invalid_pricing") from exc
        raise ConflictError("Cet element existe deja ou viole une contrainte.", code="integrity") from exc
    return obj


def _require_classroom_staff(user, classroom: Classroom) -> None:
    ok = user.is_staff or ClassroomMember.objects.filter(classroom=classroom, user=user, status="active", role__in=STAFF_ROLES).exists()
    if not ok:
        raise PermissionDeniedError("Reserve aux enseignants de la classroom.")


def _require_course_staff(user, course: Course) -> None:
    if not is_course_staff(user, course):
        raise PermissionDeniedError("Reserve aux enseignants du cours.")


# ------------------------------------------------------------------ classrooms
@transaction.atomic
def create_classroom(*, owner, title: str, slug: str, privacy: str = Classroom.Privacy.PUBLIC, description: str = "", is_paid: bool = False,
                     price_minor: int | None = None, currency: str = "", organization_ref=None, group=None) -> Classroom:
    c = _save(Classroom(owner=owner, title=title, slug=slug, privacy=privacy, description=description, is_paid=is_paid,
                        price_minor=price_minor, currency=currency, organization_ref=organization_ref, group=group))
    ClassroomMember.objects.create(classroom=c, user=owner, role="owner", status="active")
    publish_event("ClassroomCreated", "classroom", c.pk, {"owner": str(owner.pk)})
    return c


@transaction.atomic
def join_classroom(user, classroom: Classroom) -> ClassroomMember:
    """public -> actif ; private -> en attente d'approbation ; invite_only / organization -> invitation obligatoire."""
    if classroom.archived_at:
        raise DomainError("Classroom archivee.", code="archived")
    existing = ClassroomMember.objects.filter(classroom=classroom, user=user).first()
    if existing:
        if existing.status == "banned":
            raise PermissionDeniedError("Acces refuse.", code="banned")
        raise ConflictError("Deja membre ou demande en cours.", code="already_member")
    if classroom.privacy in ("invite_only", "organization"):
        raise PermissionDeniedError("Cette classroom est accessible sur invitation.", code="invite_only")
    status = "active" if classroom.privacy == "public" else "pending"
    try:
        with transaction.atomic():
            return ClassroomMember.objects.create(classroom=classroom, user=user, role="student", status=status)
    except IntegrityError as exc:
        raise ConflictError("Deja membre ou demande en cours.", code="already_member") from exc


@transaction.atomic
def review_member(classroom: Classroom, actor, member_id, approve: bool) -> ClassroomMember | None:
    _require_classroom_staff(actor, classroom)
    m = ClassroomMember.objects.select_for_update().get(pk=member_id, classroom=classroom, status="pending")
    if approve:
        m.status = "active"
        m.save(update_fields=["status"])
        return m
    m.delete()
    return None


@transaction.atomic
def ban_member(classroom: Classroom, actor, user) -> ClassroomMember:
    _require_classroom_staff(actor, classroom)
    m = ClassroomMember.objects.select_for_update().get(classroom=classroom, user=user)
    if m.role == "owner":
        raise PermissionDeniedError("Le proprietaire ne peut pas etre banni.")
    m.status = "banned"
    m.save(update_fields=["status"])
    Enrollment.objects.filter(user=user, course__classroom=classroom, status="active").update(status="dropped")
    return m


@transaction.atomic
def leave_classroom(user, classroom: Classroom) -> None:
    m = ClassroomMember.objects.filter(classroom=classroom, user=user).first()
    if not m:
        return
    if m.role == "owner":
        raise DomainError("Le proprietaire doit transferer la classroom avant de partir.", code="owner_cannot_leave")
    if m.status != "banned":  # un banni ne peut pas effacer son bannissement en partant
        m.delete()
        Enrollment.objects.filter(user=user, course__classroom=classroom, status="active").update(status="dropped")


@transaction.atomic
def invite_to_classroom(classroom: Classroom, inviter, invited_user, role: str = "student", ttl_days: int = 14) -> ClassroomInvitation:
    _require_classroom_staff(inviter, classroom)
    if ClassroomMember.objects.filter(classroom=classroom, user=invited_user, status__in=["active", "pending"]).exists():
        raise ConflictError("Deja membre.", code="already_member")
    try:
        with transaction.atomic():
            inv = ClassroomInvitation.objects.create(classroom=classroom, invited_user=invited_user, invited_by=inviter, role=role,
                                                     expires_at=timezone.now() + timedelta(days=ttl_days))
    except IntegrityError as exc:
        raise ConflictError("Invitation deja en attente.", code="already_invited") from exc
    publish_event("ClassroomInvitationSent", "classroom_invitation", inv.pk, {"to": str(invited_user.pk), "by": str(inviter.pk), "classroom": str(classroom.pk)})
    return inv


@transaction.atomic
def respond_to_classroom_invitation(invitation_id, user, accept: bool) -> ClassroomInvitation:
    inv = ClassroomInvitation.objects.select_for_update().select_related("classroom").get(pk=invitation_id, invited_user=user)
    if inv.status != "pending":
        raise ConflictError("Invitation deja traitee.", code="not_pending")
    if inv.expires_at and inv.expires_at < timezone.now():
        raise DomainError("Invitation expiree.", code="expired")
    inv.status = "accepted" if accept else "declined"
    inv.save(update_fields=["status"])
    if accept and not ClassroomMember.objects.filter(classroom=inv.classroom, user=user, status="banned").exists():
        ClassroomMember.objects.update_or_create(classroom=inv.classroom, user=user, defaults={"role": inv.role, "status": "active"})
    return inv


# ------------------------------------------------------------------ cours / contenu
@transaction.atomic
def create_course(*, classroom: Classroom, creator, title: str, slug: str, description: str = "", level: str = "beginner", language: str = "fr",
                  is_free: bool = True, price_minor: int | None = None, currency: str = "", certificate_enabled: bool = True) -> Course:
    _require_classroom_staff(creator, classroom)
    course = _save(Course(classroom=classroom, title=title, slug=slug, description=description, level=level, language=language,
                          is_free=is_free, price_minor=price_minor, currency=currency, certificate_enabled=certificate_enabled))
    CourseInstructor.objects.create(course=course, user=creator, role="lead")
    return course


@transaction.atomic
def add_instructor(course: Course, actor, user) -> CourseInstructor:
    lead = CourseInstructor.objects.filter(course=course, user=actor, role="lead").exists()
    if not (lead or actor.is_staff or ClassroomMember.objects.filter(classroom=course.classroom, user=actor, role="owner", status="active").exists()):
        raise PermissionDeniedError("Seul l'enseignant principal peut ajouter un enseignant.")
    member = ClassroomMember.objects.filter(classroom=course.classroom, user=user, status="active").first()
    if member is None:
        raise DomainError("L'enseignant doit d'abord etre membre de la classroom.", code="not_member")
    if member.role in ("student", "assistant"):
        member.role = "instructor"
        member.save(update_fields=["role"])
    obj, _ = CourseInstructor.objects.get_or_create(course=course, user=user)
    return obj


def _next_position(qs) -> int:
    return (qs.aggregate(m=Max("position"))["m"] or 0) + 1


@transaction.atomic
def add_module(course: Course, actor, *, title: str, is_free: bool = True, price_minor: int | None = None, currency: str = "", description: str = "") -> Module:
    _require_course_staff(actor, course)
    Course.objects.select_for_update().get(pk=course.pk)  # serialise l'attribution de position
    return _save(Module(course=course, position=_next_position(course.modules), title=title, is_free=is_free, price_minor=price_minor,
                        currency=currency, description=description))


@transaction.atomic
def add_chapter(module: Module, actor, *, title: str, is_free: bool = True, price_minor: int | None = None, currency: str = "", estimated_minutes: int = 10) -> Chapter:
    _require_course_staff(actor, module.course)
    Module.objects.select_for_update().get(pk=module.pk)
    return _save(Chapter(module=module, position=_next_position(module.chapters), title=title, is_free=is_free, price_minor=price_minor,
                         currency=currency, estimated_minutes=estimated_minutes))


@transaction.atomic
def add_block(chapter: Chapter, actor, *, kind: str, title: str = "", body: str = "", storage_key: str = "", url: str = "", ref_id=None,
              payload: dict | None = None, duration_seconds: int | None = None) -> ContentBlock:
    _require_course_staff(actor, chapter.module.course)
    Chapter.objects.select_for_update().get(pk=chapter.pk)
    try:
        with transaction.atomic():
            return ContentBlock.objects.create(chapter=chapter, position=_next_position(chapter.blocks), kind=kind, title=title, body=body,
                                               storage_key=storage_key, url=url, ref_id=ref_id, payload=payload or {}, duration_seconds=duration_seconds)
    except IntegrityError as exc:
        raise DomainError("Bloc invalide pour son type (contenu, fichier, https ou reference manquants).", code="invalid_block") from exc


@transaction.atomic
def publish_course(course: Course, actor) -> Course:
    """Un cours publie doit etre utilisable : au moins un chapitre, et un module payant doit vendre au moins un chapitre payant."""
    _require_course_staff(actor, course)
    modules = list(course.modules.prefetch_related("chapters"))
    if not any(ch for m in modules for ch in m.chapters.all()):
        raise DomainError("Un cours publie doit contenir au moins un chapitre.", code="empty_course")
    for m in modules:
        chapters = list(m.chapters.all())
        if not m.is_free and not any(not c.is_free for c in chapters):
            raise DomainError(f"Le module payant « {m.title} » ne contient aucun chapitre payant.", code="paid_module_without_paid_chapter")
    course.modules.update(is_published=True)
    Chapter.objects.filter(module__course=course).update(is_published=True)
    course.status, course.published_at = Course.Status.PUBLISHED, timezone.now()
    course.save(update_fields=["status", "published_at"])
    publish_event("CoursePublished", "course", course.pk, {"classroom": str(course.classroom_id)})
    return course


# ------------------------------------------------------------------ inscription
@transaction.atomic
def enroll(user, course: Course) -> tuple[Enrollment, bool]:
    """Idempotent. Refuse : cours non publie, classroom privee sans adhesion active, classroom payante sans droit."""
    if course.status != Course.Status.PUBLISHED:
        raise DomainError("Ce cours n'est pas ouvert aux inscriptions.", code="not_published")
    classroom = course.classroom
    member = ClassroomMember.objects.filter(classroom=classroom, user=user).first()
    if member and member.status == "banned":
        raise PermissionDeniedError("Acces refuse.", code="banned")
    if classroom.privacy != "public" and not (member and member.status == "active"):
        raise PermissionDeniedError("Adhesion a la classroom requise.", code="membership_required")
    if classroom.is_paid and not has_classroom_entitlement(user, classroom.pk):
        raise PermissionDeniedError("Cette classroom est payante.", code="classroom_payment_required")
    if member is None:
        member = ClassroomMember.objects.get_or_create(classroom=classroom, user=user, defaults={"role": "student", "status": "active"})[0]
    existing = Enrollment.objects.filter(course=course, user=user).first()
    if existing:
        if existing.status == "dropped":
            existing.status = "active"
            existing.save(update_fields=["status"])
        return existing, False
    try:
        with transaction.atomic():
            e = Enrollment.objects.create(course=course, user=user)
    except IntegrityError:  # inscription simultanee : l'autre a gagne
        return Enrollment.objects.get(course=course, user=user), False
    publish_event("CourseEnrolled", "enrollment", e.pk, {"user": str(user.pk), "course": str(course.pk),
                                                       "instructors": [str(i) for i in course.instructors.values_list("user_id", flat=True)]})
    return e, True


@transaction.atomic
def drop_enrollment(user, course: Course) -> None:
    Enrollment.objects.filter(user=user, course=course, status="active").update(status="dropped")


# ------------------------------------------------------------------ droits d'acces (appeles par le futur domaine paiements)
def _target_course(scope: str, target) -> Course:
    return {"classroom": None, "course": target, "module": getattr(target, "course", None), "chapter": getattr(getattr(target, "module", None), "course", None)}[scope]


@transaction.atomic
def grant_entitlement(user, scope: str, target, *, source: str, source_ref: str = "", grant_key: str = "", expires_at=None, granted_by=None) -> tuple[Entitlement, bool]:
    """IDEMPOTENT par `grant_key` : rejouer un webhook de paiement ne cree jamais deux droits. Retourne (droit, cree?)."""
    if scope not in {"classroom", "course", "module", "chapter"}:
        raise DomainError("Portee inconnue.", code="invalid_scope")
    if source in ("grant", "instructor"):
        course = target if scope == "course" else _target_course(scope, target)
        classroom = target if scope == "classroom" else course.classroom
        staff = granted_by is not None and (granted_by.is_staff or ClassroomMember.objects.filter(classroom=classroom, user=granted_by, status="active", role__in=STAFF_ROLES).exists())
        if not staff:
            raise PermissionDeniedError("Seul un enseignant peut offrir un acces.")
    if grant_key:
        existing = Entitlement.objects.filter(grant_key=grant_key).first()
        if existing:
            return existing, False
    fields = {scope: target}
    try:
        with transaction.atomic():
            ent = Entitlement.objects.create(user=user, scope=scope, source=source, source_ref=source_ref, grant_key=grant_key, expires_at=expires_at, **fields)
    except IntegrityError:
        return Entitlement.objects.get(grant_key=grant_key), False
    publish_event("EntitlementGranted", "entitlement", ent.pk, {"user": str(user.pk), "scope": scope})
    return ent, True


@transaction.atomic
def revoke_entitlement(entitlement_id, *, by) -> Entitlement:
    ent = Entitlement.objects.select_for_update().get(pk=entitlement_id)
    if not by.is_staff:
        raise PermissionDeniedError("Reserve a l'administration.")
    ent.revoked_at = timezone.now()
    ent.save(update_fields=["revoked_at"])
    publish_event("EntitlementRevoked", "entitlement", ent.pk, {"user": str(ent.user_id)})
    return ent
