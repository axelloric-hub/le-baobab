from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.companies.models import Company, CompanyMember, CompanyProject, CompanyService, CompanySocialLink, CompanyVerification
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event

RANK = {"owner": 4, "admin": 3, "recruiter": 2, "editor": 1, "employee": 0}
MANAGERS = ("owner", "admin")


def member_role(user, company: Company) -> str | None:
    return CompanyMember.objects.filter(company=company, user=user).values_list("role", flat=True).first()


def require_role(user, company: Company, roles: tuple[str, ...]) -> str:
    role = member_role(user, company)
    if not (user.is_staff or role in roles):
        raise PermissionDeniedError("Role insuffisant dans cette entreprise.")
    return role or "owner"


@transaction.atomic
def create_company(creator, *, name: str, slug: str, **fields) -> Company:
    try:
        with transaction.atomic():
            company = Company.objects.create(name=name, slug=slug, **fields)
    except IntegrityError as exc:
        raise ConflictError("Ce nom d'entreprise est deja pris (ou taille invalide).", code="slug_taken") from exc
    CompanyMember.objects.create(company=company, user=creator, role="owner", title="Fondateur")
    publish_event("CompanyCreated", "company", company.pk, {"owner": str(creator.pk)})
    return company


def _owner_count(company: Company) -> int:
    return CompanyMember.objects.filter(company=company, role="owner").count()


@transaction.atomic
def add_member(company: Company, actor, user, role: str = "employee", title: str = "") -> CompanyMember:
    actor_role = require_role(actor, company, MANAGERS)
    if role not in RANK:
        raise DomainError("Role inconnu.", code="invalid_role")
    if role in MANAGERS and actor_role != "owner" and not actor.is_staff:
        raise PermissionDeniedError("Seul un proprietaire peut nommer un administrateur ou un proprietaire.")
    try:
        with transaction.atomic():
            return CompanyMember.objects.create(company=company, user=user, role=role, title=title)
    except IntegrityError as exc:
        raise ConflictError("Deja membre.", code="already_member") from exc


@transaction.atomic
def change_role(company: Company, actor, user, role: str) -> CompanyMember:
    Company.objects.select_for_update().get(pk=company.pk)  # serialise les changements de roles
    actor_role = require_role(actor, company, MANAGERS)
    target = CompanyMember.objects.select_for_update().get(company=company, user=user)
    if role not in RANK:
        raise DomainError("Role inconnu.", code="invalid_role")
    if (RANK[role] >= RANK["admin"] or RANK[target.role] >= RANK["admin"]) and actor_role != "owner" and not actor.is_staff:
        raise PermissionDeniedError("Seul un proprietaire modifie les roles administrateur/proprietaire.")
    if target.role == "owner" and role != "owner" and _owner_count(company) <= 1:
        raise DomainError("L'entreprise doit conserver au moins un proprietaire.", code="last_owner")
    target.role = role
    target.save(update_fields=["role"])
    return target


@transaction.atomic
def remove_member(company: Company, actor, user) -> None:
    Company.objects.select_for_update().get(pk=company.pk)
    target = CompanyMember.objects.select_for_update().filter(company=company, user=user).first()
    if target is None:
        return
    if actor.pk != user.pk:
        actor_role = require_role(actor, company, MANAGERS)
        if RANK[target.role] >= RANK[actor_role] and not actor.is_staff:
            raise PermissionDeniedError("Impossible de retirer un membre de rang egal ou superieur.")
    if target.role == "owner" and _owner_count(company) <= 1:
        raise DomainError("Transferez la propriete avant de partir.", code="last_owner")
    target.delete()


@transaction.atomic
def submit_verification(company: Company, actor, *, method: str, evidence: dict | None = None) -> CompanyVerification:
    require_role(actor, company, MANAGERS)
    try:
        with transaction.atomic():
            return CompanyVerification.objects.create(company=company, method=method, evidence=evidence or {}, submitted_by=actor)
    except IntegrityError as exc:
        raise ConflictError("Une demande de verification est deja en cours.", code="verification_pending") from exc


@transaction.atomic
def review_verification(verification_id, reviewer, *, approve: bool, notes: str = "") -> CompanyVerification:
    if not reviewer.is_staff:
        raise PermissionDeniedError("Reserve a l'administration.")
    v = CompanyVerification.objects.select_for_update(of=("self",)).select_related("company").get(pk=verification_id)
    if v.status != "pending":
        raise ConflictError("Demande deja traitee.", code="not_pending")
    v.status, v.reviewed_by, v.reviewed_at, v.notes = ("approved" if approve else "rejected"), reviewer, timezone.now(), notes[:500]
    v.save()
    if approve:
        Company.objects.filter(pk=v.company_id).update(status="verified")
    publish_event("CompanyVerificationReviewed", "company", v.company_id, {"approved": approve})
    return v


def set_social_link(company: Company, actor, *, provider: str, url: str) -> CompanySocialLink:
    require_role(actor, company, MANAGERS + ("editor",))
    try:
        with transaction.atomic():
            return CompanySocialLink.objects.get_or_create(company=company, provider=provider, url=url)[0]
    except IntegrityError as exc:
        raise DomainError("Les liens doivent utiliser https.", code="invalid_url") from exc


def add_project(company: Company, actor, **fields) -> CompanyProject:
    require_role(actor, company, MANAGERS + ("editor",))
    return CompanyProject.objects.create(company=company, **fields)


def add_service(company: Company, actor, **fields) -> CompanyService:
    require_role(actor, company, MANAGERS + ("editor",))
    try:
        with transaction.atomic():
            return CompanyService.objects.create(company=company, **fields)
    except IntegrityError as exc:
        raise DomainError("Un prix exige une devise.", code="invalid_service") from exc
