from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.companies.models import Company, CompanyMember
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.jobs.models import (
    ApplicationStatusEvent, Contract, FreelancerProfile, Interview, InterviewSlot, Job, JobApplication, JobSkill, Milestone, Offer, Proposal,
)

RECRUITER_ROLES = ("owner", "admin", "recruiter")
# Machine a etats des candidatures : seules ces transitions existent.
TRANSITIONS = {
    "submitted": {"reviewing", "rejected", "withdrawn"},
    "reviewing": {"shortlisted", "rejected", "withdrawn"},
    "shortlisted": {"interview", "rejected", "withdrawn"},
    "interview": {"offer", "rejected", "withdrawn"},
    "offer": {"hired", "rejected", "withdrawn"},
    "hired": set(), "rejected": set(), "withdrawn": set(),
}


def can_manage_job(user, job: Job) -> bool:
    if user.is_staff or job.posted_by_id == user.pk:
        return True
    return bool(job.company_id) and CompanyMember.objects.filter(company_id=job.company_id, user=user, role__in=RECRUITER_ROLES).exists()


def _require_manager(user, job: Job) -> None:
    if not can_manage_job(user, job):
        raise PermissionDeniedError("Reserve aux recruteurs de cette offre.")


# ------------------------------------------------------------------ offres
@transaction.atomic
def create_job(poster, *, title: str, description: str, job_type: str, contract_type: str, company: Company | None = None, skills: list[dict] | None = None,
               salary: dict | None = None, **fields) -> Job:
    if company is not None:
        if company.status == "suspended":
            raise DomainError("Entreprise suspendue.", code="company_suspended")
        if not (poster.is_staff or CompanyMember.objects.filter(company=company, user=poster, role__in=RECRUITER_ROLES).exists()):
            raise PermissionDeniedError("Vous ne pouvez pas publier pour cette entreprise.")
    elif job_type != "freelance":
        raise DomainError("Une offre d'emploi doit etre rattachee a une entreprise.", code="company_required")
    if job_type == "freelance" and contract_type != "freelance":
        raise DomainError("Une offre freelance a un contrat freelance.", code="inconsistent_contract")
    sal = salary or {}
    try:
        with transaction.atomic():
            job = Job.objects.create(company=company, posted_by=poster, title=title, description=description, job_type=job_type, contract_type=contract_type,
                                     salary_min_minor=sal.get("min"), salary_max_minor=sal.get("max"), salary_currency=sal.get("currency", ""), salary_period=sal.get("period", ""), **fields)
            JobSkill.objects.bulk_create([JobSkill(job=job, skill=s["skill"], is_required=s.get("required", True)) for s in (skills or [])])
    except IntegrityError as exc:
        raise DomainError("Fourchette de salaire incoherente (min <= max, devise et periode requises).", code="invalid_salary") from exc
    return job


@transaction.atomic
def publish_job(job: Job, actor) -> Job:
    _require_manager(actor, job)
    job = Job.objects.select_for_update().get(pk=job.pk)
    if job.status not in ("draft", "paused"):
        raise ConflictError("Seule une offre en brouillon ou en pause peut etre publiee.", code="invalid_state")
    if len(job.description) < 50 or not job.job_skills.exists():
        raise DomainError("Une offre publiee exige une description detaillee (50 caracteres) et au moins une competence.", code="incomplete_job")
    if job.company_id and job.company.status == "suspended":
        raise DomainError("Entreprise suspendue.", code="company_suspended")
    job.status = "open"
    job.published_at = job.published_at or timezone.now()
    job.save(update_fields=["status", "published_at", "updated_at"])
    publish_event("JobPublished", "job", job.pk, {"company": str(job.company_id) if job.company_id else None})
    return job


@transaction.atomic
def close_job(job: Job, actor, *, filled: bool = False) -> Job:
    _require_manager(actor, job)
    job = Job.objects.select_for_update().get(pk=job.pk)
    job.status = "filled" if filled else "closed"
    job.save(update_fields=["status", "updated_at"])
    return job


# ------------------------------------------------------------------ candidatures
def _history(app: JobApplication, from_status: str, to_status: str, by, note: str = "") -> None:
    ApplicationStatusEvent.objects.create(application=app, from_status=from_status, to_status=to_status, changed_by=by, note=note[:500])


@transaction.atomic
def apply(job_id, applicant, *, cover_letter: str = "", cv_storage_key: str = "", project_ids=(), **fields) -> JobApplication:
    job = Job.objects.select_related("company").get(pk=job_id)
    if job.status != "open" or (job.deadline and job.deadline < timezone.now()):
        raise DomainError("Cette offre n'accepte plus de candidatures.", code="job_closed")
    if job.job_type == "freelance":
        raise DomainError("Pour une mission freelance, envoyez une proposition.", code="use_proposal")
    if can_manage_job(applicant, job):
        raise PermissionDeniedError("Vous ne pouvez pas postuler a votre propre offre.", code="own_job")
    if not (cover_letter.strip() or cv_storage_key):
        raise DomainError("Une candidature doit contenir une lettre ou un CV.", code="empty_application")
    try:
        with transaction.atomic():
            app = JobApplication.objects.create(job=job, applicant=applicant, cover_letter=cover_letter, cv_storage_key=cv_storage_key, **fields)
    except IntegrityError as exc:
        raise ConflictError("Vous avez deja postule a cette offre.", code="already_applied") from exc
    if project_ids:
        from apps.portfolio.models import Project

        app.projects.set(Project.objects.filter(pk__in=project_ids, portfolio__user=applicant))  # seuls SES projets peuvent etre joints
    _history(app, "", "submitted", applicant)
    publish_event("JobApplied", "application", app.pk, {"user": str(applicant.pk), "job": str(job.pk), "recruiters": _recruiter_ids(job)})
    return app


def _recruiter_ids(job: Job) -> list[str]:
    ids = {str(job.posted_by_id)}
    if job.company_id:
        ids |= {str(i) for i in CompanyMember.objects.filter(company_id=job.company_id, role__in=RECRUITER_ROLES).values_list("user_id", flat=True)}
    return sorted(ids)


@transaction.atomic
def transition_application(app_id, actor, to_status: str, note: str = "") -> JobApplication:
    app = JobApplication.objects.select_for_update(of=("self",)).select_related("job__company").get(pk=app_id)
    if to_status == "withdrawn":
        if actor.pk != app.applicant_id:
            raise PermissionDeniedError("Seul le candidat peut retirer sa candidature.")
    else:
        _require_manager(actor, app.job)
    if to_status not in TRANSITIONS.get(app.status, set()):
        raise DomainError(f"Transition impossible : {app.status} -> {to_status}.", code="invalid_transition")
    previous, app.status = app.status, to_status
    app.save(update_fields=["status", "updated_at"])
    _history(app, previous, to_status, actor, note)
    publish_event("ApplicationStatusChanged", "application", app.pk, {"user": str(app.applicant_id), "job": str(app.job_id), "from": previous, "to": to_status})
    return app


# ------------------------------------------------------------------ entretiens
@transaction.atomic
def create_slot(actor, job: Job, *, starts_at, ends_at) -> InterviewSlot:
    _require_manager(actor, job)
    try:
        with transaction.atomic():
            return InterviewSlot.objects.create(interviewer=actor, job=job, starts_at=starts_at, ends_at=ends_at)
    except IntegrityError as exc:
        raise ConflictError("Ce creneau chevauche un autre creneau du recruteur (ou sa fin precede son debut).", code="slot_overlap") from exc


@transaction.atomic
def book_slot(app_id, slot_id, actor, *, mode: str = "video", location: str = "") -> Interview:
    app = JobApplication.objects.select_for_update(of=("self",)).select_related("job").get(pk=app_id)
    if actor.pk != app.applicant_id:
        _require_manager(actor, app.job)
    slot = InterviewSlot.objects.select_for_update(of=("self",)).get(pk=slot_id, job_id=app.job_id)
    if app.status not in ("shortlisted", "interview"):
        raise DomainError("Un entretien suppose une candidature pre-selectionnee.", code="invalid_state")
    if slot.booked_by_id is not None:
        raise ConflictError("Creneau deja reserve.", code="slot_taken")
    if slot.starts_at < timezone.now():
        raise DomainError("Creneau passe.", code="slot_past")
    try:
        with transaction.atomic():
            slot.booked_by = app
            slot.save(update_fields=["booked_by"])
    except IntegrityError as exc:
        raise ConflictError("Cette candidature a deja un creneau reserve.", code="already_booked") from exc
    interview = Interview.objects.create(application=app, slot=slot, mode=mode, location=location)
    if app.status == "shortlisted":
        app.status = "interview"
        app.save(update_fields=["status", "updated_at"])
        _history(app, "shortlisted", "interview", actor, "creneau reserve")
    publish_event("InterviewScheduled", "interview", interview.pk, {"user": str(app.applicant_id), "interviewer": str(slot.interviewer_id), "starts_at": slot.starts_at.isoformat()})
    return interview


# ------------------------------------------------------------------ offres d'embauche
@transaction.atomic
def make_offer(app_id, actor, *, amount_minor: int, currency: str, period: str = "month", start_date=None, valid_days: int = 7) -> Offer:
    app = JobApplication.objects.select_for_update(of=("self",)).select_related("job").get(pk=app_id)
    _require_manager(actor, app.job)
    if app.status != "interview":
        raise DomainError("Une offre suit un entretien.", code="invalid_state")
    try:
        with transaction.atomic():
            offer = Offer.objects.create(application=app, amount_minor=amount_minor, currency=currency.upper(), period=period, start_date=start_date,
                                         expires_at=timezone.now() + timedelta(days=valid_days))
    except IntegrityError as exc:
        raise DomainError("Montant/devise invalides ou offre deja en cours.", code="invalid_offer") from exc
    app.status = "offer"
    app.save(update_fields=["status", "updated_at"])
    _history(app, "interview", "offer", actor)
    publish_event("OfferSent", "offer", offer.pk, {"user": str(app.applicant_id), "job": str(app.job_id)})
    return offer


@transaction.atomic
def respond_to_offer(offer_id, applicant, *, accept: bool) -> Offer:
    offer = Offer.objects.select_for_update(of=("self",)).select_related("application__job").get(pk=offer_id, application__applicant=applicant)
    app = JobApplication.objects.select_for_update(of=("self",)).get(pk=offer.application_id)
    if offer.status != "sent":
        raise ConflictError("Offre deja traitee.", code="not_pending")
    if offer.expires_at and offer.expires_at < timezone.now():
        raise DomainError("Offre expiree.", code="offer_expired")
    offer.decided_at = timezone.now()
    if accept:
        offer.status, app.status = "accepted", "hired"
        _history(app, "offer", "hired", applicant, "offre acceptee")
        Contract.objects.create(kind="employment", client=offer.application.job.posted_by, contractor=applicant, application=app, amount_minor=offer.amount_minor,
                                currency=offer.currency, start_date=offer.start_date or timezone.localdate())
    else:
        offer.status, app.status = "declined", "withdrawn"
        _history(app, "offer", "withdrawn", applicant, "offre refusee")
    offer.save(update_fields=["status", "decided_at"])
    app.save(update_fields=["status", "updated_at"])
    publish_event("OfferAnswered", "offer", offer.pk, {"accepted": accept, "job": str(app.job_id), "recruiters": _recruiter_ids(offer.application.job)})
    return offer


# ------------------------------------------------------------------ freelance
def upsert_freelancer_profile(user, **fields) -> FreelancerProfile:
    try:
        with transaction.atomic():
            return FreelancerProfile.objects.update_or_create(user=user, defaults=fields)[0]
    except IntegrityError as exc:
        raise DomainError("Un tarif horaire exige une devise.", code="invalid_profile") from exc


@transaction.atomic
def submit_proposal(job_id, freelancer, *, cover_letter: str, bid_minor: int, currency: str, delivery_days: int) -> Proposal:
    job = Job.objects.get(pk=job_id)
    if job.job_type != "freelance":
        raise DomainError("Cette offre n'est pas une mission freelance.", code="not_freelance")
    if job.status != "open" or (job.deadline and job.deadline < timezone.now()):
        raise DomainError("Cette mission n'accepte plus de propositions.", code="job_closed")
    if can_manage_job(freelancer, job):
        raise PermissionDeniedError("Vous ne pouvez pas repondre a votre propre mission.", code="own_job")
    try:
        with transaction.atomic():
            p = Proposal.objects.create(job=job, freelancer=freelancer, cover_letter=cover_letter, bid_minor=bid_minor, currency=currency.upper(), delivery_days=delivery_days)
    except IntegrityError as exc:
        if Proposal.objects.filter(job=job, freelancer=freelancer).exists():
            raise ConflictError("Vous avez deja propose pour cette mission.", code="already_proposed") from exc
        raise DomainError("Montant, delai ou devise invalides.", code="invalid_proposal") from exc
    publish_event("ProposalReceived", "proposal", p.pk, {"job": str(job.pk), "recruiters": _recruiter_ids(job)})
    return p


@transaction.atomic
def accept_proposal(proposal_id, client, *, milestones: list[dict] | None = None) -> Contract:
    p = Proposal.objects.select_for_update(of=("self",)).select_related("job").get(pk=proposal_id)
    job = Job.objects.select_for_update().get(pk=p.job_id)
    _require_manager(client, job)
    if p.status != "submitted" or job.status != "open":
        raise ConflictError("Proposition non acceptable (deja traitee ou mission fermee).", code="invalid_state")
    plan = milestones or [{"title": "Livraison complete", "amount_minor": p.bid_minor}]
    if sum(m["amount_minor"] for m in plan) != p.bid_minor:
        raise DomainError("La somme des jalons doit egaler la proposition acceptee.", code="milestones_total_mismatch")
    p.status = "accepted"
    p.save(update_fields=["status"])
    Proposal.objects.filter(job=job, status="submitted").exclude(pk=p.pk).update(status="rejected")
    job.status = "filled"
    job.save(update_fields=["status", "updated_at"])
    try:
        with transaction.atomic():
            contract = Contract.objects.create(kind="freelance", client=client, contractor=p.freelancer, proposal=p, amount_minor=p.bid_minor, currency=p.currency)
            Milestone.objects.bulk_create([Milestone(contract=contract, position=i + 1, title=m["title"], amount_minor=m["amount_minor"], due_on=m.get("due_on")) for i, m in enumerate(plan)])
    except IntegrityError as exc:
        raise DomainError("Contrat invalide (parties identiques ou jalon a montant nul).", code="invalid_contract") from exc
    publish_event("ProposalAccepted", "proposal", p.pk, {"freelancer": str(p.freelancer_id), "job": str(job.pk)})
    return contract


MILESTONE_FLOW = {"start": ("pending", "in_progress"), "submit": ("in_progress", "submitted"), "approve": ("submitted", "approved")}


@transaction.atomic
def advance_milestone(milestone_id, actor, action: str) -> Milestone:
    """start / submit : par le prestataire ; approve : par le client. Quand tous les jalons sont valides, le contrat est termine."""
    m = Milestone.objects.select_for_update(of=("self",)).select_related("contract").get(pk=milestone_id)
    contract = m.contract
    if contract.status != "active":
        raise DomainError("Contrat non actif.", code="contract_inactive")
    expected_from, to = MILESTONE_FLOW[action]
    party = contract.client_id if action == "approve" else contract.contractor_id
    if actor.pk != party:
        raise PermissionDeniedError("Action reservee a l'autre partie du contrat.")
    if m.status != expected_from:
        raise DomainError(f"Transition impossible : {m.status} -> {to}.", code="invalid_transition")
    m.status = to
    if to == "approved":
        m.approved_at = timezone.now()
    m.save()
    if to == "approved" and not contract.milestones.exclude(status="approved").exists():
        contract.status = "completed"
        contract.save(update_fields=["status"])
        publish_event("ContractCompleted", "contract", contract.pk, {"client": str(contract.client_id), "contractor": str(contract.contractor_id)})
    return m


@transaction.atomic
def terminate_contract(contract_id, actor) -> Contract:
    c = Contract.objects.select_for_update().get(pk=contract_id)
    if actor.pk not in (c.client_id, c.contractor_id) and not actor.is_staff:
        raise PermissionDeniedError("Reserve aux parties du contrat.")
    if c.status != "active":
        raise ConflictError("Contrat deja clos.", code="not_active")
    c.status, c.end_date = "terminated", timezone.localdate()
    c.save(update_fields=["status", "end_date"])
    return c
