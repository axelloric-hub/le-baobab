"""Recrutement ET freelance. Candidate = utilisateur ; Employer = membre recruteur d'une entreprise (pas de tables doublons).
Machine a etats des candidatures dans jobs.services (matrice de transitions) + historique append-only (trigger).
Garanties par la BASE : une seule candidature par (offre, candidat), un seul creneau par instant et par recruteur (contrainte d'exclusion),
fourchettes de salaire coherentes, un seul contrat par source."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class JobCategory(models.Model):
    id = models.BigAutoField(primary_key=True)
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "jobs_category"
        verbose_name_plural = "job categories"


class Job(UUIDModel):
    class Type(models.TextChoices):
        FULL_TIME = "full_time", "Temps plein"
        PART_TIME = "part_time", "Temps partiel"
        INTERNSHIP = "internship", "Stage"
        CONTRACT = "contract", "Mission"
        FREELANCE = "freelance", "Freelance (projet)"

    class Contract(models.TextChoices):
        PERMANENT = "permanent", "CDI"
        FIXED_TERM = "fixed_term", "CDD"
        FREELANCE = "freelance", "Freelance"
        INTERNSHIP = "internship", "Stage"

    class Level(models.TextChoices):
        JUNIOR = "junior", "Junior"
        MID = "mid", "Confirme"
        SENIOR = "senior", "Senior"
        LEAD = "lead", "Lead / Principal"

    class Remote(models.TextChoices):
        ONSITE = "onsite", "Sur site"
        HYBRID = "hybrid", "Hybride"
        REMOTE = "remote", "Teletravail"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        OPEN = "open", "Ouverte"
        PAUSED = "paused", "En pause"
        CLOSED = "closed", "Fermee"
        FILLED = "filled", "Pourvue"

    company = models.ForeignKey("companies.Company", null=True, blank=True, on_delete=models.CASCADE, related_name="jobs")
    posted_by = models.ForeignKey(U, on_delete=models.PROTECT, related_name="posted_jobs")
    category = models.ForeignKey(JobCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="jobs")
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=20000)
    job_type = models.CharField(max_length=12, choices=Type.choices)
    contract_type = models.CharField(max_length=12, choices=Contract.choices)
    experience_level = models.CharField(max_length=8, choices=Level.choices, default=Level.MID)
    remote_policy = models.CharField(max_length=8, choices=Remote.choices, default=Remote.ONSITE)
    country = models.ForeignKey("profiles.Country", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    city = models.CharField(max_length=80, blank=True)
    salary_min_minor = models.PositiveBigIntegerField(null=True, blank=True)
    salary_max_minor = models.PositiveBigIntegerField(null=True, blank=True)
    salary_currency = models.CharField(max_length=3, blank=True)
    salary_period = models.CharField(max_length=6, blank=True)  # hour, day, month, year
    skills = models.ManyToManyField("profiles.Skill", through="JobSkill", related_name="jobs")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "jobs_job"
        constraints = [
            models.CheckConstraint(condition=Q(salary_min_minor__isnull=True, salary_max_minor__isnull=True)
                                   | Q(salary_min_minor__isnull=False, salary_max_minor__isnull=False, salary_min_minor__lte=models.F("salary_max_minor")) & ~Q(salary_currency="") & ~Q(salary_period=""),
                                   name="chk_job_salary"),
            models.CheckConstraint(condition=Q(salary_period__in=["", "hour", "day", "month", "year"]), name="chk_job_salary_period"),
            models.CheckConstraint(condition=~Q(status="open") | Q(published_at__isnull=False), name="chk_job_open_dated"),
            models.CheckConstraint(condition=Q(deadline__isnull=True) | Q(published_at__isnull=True) | Q(deadline__gt=models.F("published_at")), name="chk_job_deadline"),
        ]
        indexes = [models.Index(fields=["-published_at"], name="job_open_idx", condition=Q(status="open")),
                   models.Index(fields=["country", "job_type", "-published_at"], name="job_filter_idx", condition=Q(status="open")),
                   models.Index(fields=["company", "status"], name="job_company_idx")]


class JobSkill(models.Model):
    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="job_skills")
    skill = models.ForeignKey("profiles.Skill", on_delete=models.CASCADE, related_name="+")
    is_required = models.BooleanField(default=True)

    class Meta:
        db_table = "jobs_job_skill"
        constraints = [models.UniqueConstraint(fields=["job", "skill"], name="uniq_job_skill")]
        indexes = [models.Index(fields=["skill"], name="jobskill_skill_idx")]  # "toutes les offres Django"


class JobApplication(UUIDModel):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Envoyee"
        REVIEWING = "reviewing", "En cours d'examen"
        SHORTLISTED = "shortlisted", "Pre-selectionnee"
        INTERVIEW = "interview", "Entretien"
        OFFER = "offer", "Offre"
        HIRED = "hired", "Embauche"
        REJECTED = "rejected", "Refusee"
        WITHDRAWN = "withdrawn", "Retiree"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="applications")
    applicant = models.ForeignKey(U, on_delete=models.PROTECT, related_name="job_applications")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUBMITTED)
    cover_letter = models.TextField(max_length=10000, blank=True)
    cv_storage_key = models.CharField(max_length=400, blank=True)
    portfolio_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    gitlab_url = models.URLField(blank=True)
    links = models.JSONField(default=list, blank=True)
    documents = models.JSONField(default=list, blank=True)  # [{"storage_key","filename"}]
    expected_salary_minor = models.PositiveBigIntegerField(null=True, blank=True)
    available_from = models.DateField(null=True, blank=True)
    projects = models.ManyToManyField("portfolio.Project", blank=True, related_name="+", db_table="jobs_application_project")  # projets du portfolio joints
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "jobs_application"
        constraints = [models.UniqueConstraint(fields=["job", "applicant"], name="uniq_application")]  # pas de double candidature : garanti par la base
        indexes = [models.Index(fields=["job", "status", "-created_at"], name="application_job_idx"),
                   models.Index(fields=["applicant", "-created_at"], name="application_user_idx")]


class ApplicationStatusEvent(models.Model):
    """Historique append-only des changements de statut (trigger)."""

    id = models.BigAutoField(primary_key=True)
    application = models.ForeignKey(JobApplication, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=12, blank=True)
    to_status = models.CharField(max_length=12)
    changed_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "jobs_application_status_event"
        indexes = [models.Index(fields=["application", "created_at"], name="appstatus_app_idx")]


class InterviewSlot(UUIDModel):
    """Creneau propose par un recruteur. La base INTERDIT deux creneaux qui se chevauchent pour le meme recruteur (exclusion)."""

    interviewer = models.ForeignKey(U, on_delete=models.CASCADE, related_name="interview_slots")
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="slots")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    booked_by = models.OneToOneField(JobApplication, null=True, blank=True, on_delete=models.SET_NULL, related_name="slot")  # un candidat = un creneau

    class Meta:
        db_table = "jobs_interview_slot"
        constraints = [models.CheckConstraint(condition=Q(ends_at__gt=models.F("starts_at")), name="chk_slot_period")]
        indexes = [models.Index(fields=["job", "starts_at"], name="slot_free_idx", condition=Q(booked_by__isnull=True))]


class Interview(UUIDModel):
    class Mode(models.TextChoices):
        VIDEO = "video", "Visio"
        PHONE = "phone", "Telephone"
        ONSITE = "onsite", "Sur site"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Planifie"
        COMPLETED = "completed", "Termine"
        CANCELLED = "cancelled", "Annule"
        NO_SHOW = "no_show", "Absent"

    application = models.ForeignKey(JobApplication, on_delete=models.CASCADE, related_name="interviews")
    slot = models.OneToOneField(InterviewSlot, null=True, blank=True, on_delete=models.SET_NULL, related_name="interview")
    mode = models.CharField(max_length=8, choices=Mode.choices, default=Mode.VIDEO)
    location = models.CharField(max_length=300, blank=True)  # lien visio ou adresse
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    feedback = models.TextField(max_length=5000, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "jobs_interview"


class Offer(UUIDModel):
    class Status(models.TextChoices):
        SENT = "sent", "Envoyee"
        ACCEPTED = "accepted", "Acceptee"
        DECLINED = "declined", "Refusee"
        WITHDRAWN = "withdrawn", "Retiree"

    application = models.ForeignKey(JobApplication, on_delete=models.CASCADE, related_name="offers")
    amount_minor = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3)
    period = models.CharField(max_length=6, default="month")
    start_date = models.DateField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SENT)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "jobs_offer"
        constraints = [models.CheckConstraint(condition=Q(amount_minor__gt=0) & ~Q(currency=""), name="chk_offer_amount"),
                       models.UniqueConstraint(fields=["application"], condition=Q(status__in=["sent", "accepted"]), name="uniq_offer_active")]


class FreelancerProfile(models.Model):
    user = models.OneToOneField(U, primary_key=True, on_delete=models.CASCADE, related_name="freelancer_profile")
    headline = models.CharField(max_length=160, blank=True)
    hourly_rate_minor = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    is_available = models.BooleanField(default=True)
    languages = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "jobs_freelancer_profile"
        constraints = [models.CheckConstraint(condition=Q(hourly_rate_minor__isnull=True) | ~Q(currency=""), name="chk_freelancer_currency")]
        indexes = [models.Index(fields=["hourly_rate_minor"], name="freelancer_available_idx", condition=Q(is_available=True))]


class Proposal(UUIDModel):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Envoyee"
        ACCEPTED = "accepted", "Acceptee"
        REJECTED = "rejected", "Refusee"
        WITHDRAWN = "withdrawn", "Retiree"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="proposals")
    freelancer = models.ForeignKey(U, on_delete=models.PROTECT, related_name="proposals")
    cover_letter = models.TextField(max_length=10000)
    bid_minor = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3)
    delivery_days = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SUBMITTED)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "jobs_proposal"
        constraints = [models.UniqueConstraint(fields=["job", "freelancer"], name="uniq_proposal"),
                       models.UniqueConstraint(fields=["job"], condition=Q(status="accepted"), name="uniq_proposal_accepted_per_job"),  # un seul freelance retenu
                       models.CheckConstraint(condition=Q(bid_minor__gt=0, delivery_days__gt=0) & ~Q(currency=""), name="chk_proposal_values")]


class Contract(UUIDModel):
    class Kind(models.TextChoices):
        EMPLOYMENT = "employment", "Emploi"
        FREELANCE = "freelance", "Freelance"

    class Status(models.TextChoices):
        ACTIVE = "active", "En cours"
        COMPLETED = "completed", "Termine"
        TERMINATED = "terminated", "Resilie"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    client = models.ForeignKey(U, on_delete=models.PROTECT, related_name="contracts_as_client")
    contractor = models.ForeignKey(U, on_delete=models.PROTECT, related_name="contracts_as_contractor")
    application = models.OneToOneField(JobApplication, null=True, blank=True, on_delete=models.PROTECT, related_name="contract")
    proposal = models.OneToOneField(Proposal, null=True, blank=True, on_delete=models.PROTECT, related_name="contract")
    amount_minor = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3)
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "jobs_contract"
        constraints = [models.CheckConstraint(condition=Q(application__isnull=False, proposal__isnull=True) | Q(application__isnull=True, proposal__isnull=False), name="chk_contract_single_source"),
                       models.CheckConstraint(condition=~Q(client=models.F("contractor")), name="chk_contract_distinct_parties"),
                       models.CheckConstraint(condition=Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date")), name="chk_contract_dates")]


class Milestone(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "A faire"
        IN_PROGRESS = "in_progress", "En cours"
        SUBMITTED = "submitted", "Livre"
        APPROVED = "approved", "Valide"

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="milestones")
    position = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=160)
    amount_minor = models.PositiveBigIntegerField()
    due_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "jobs_milestone"
        constraints = [models.UniqueConstraint(fields=["contract", "position"], name="uniq_milestone_position"),
                       models.CheckConstraint(condition=Q(amount_minor__gt=0), name="chk_milestone_amount"),
                       models.CheckConstraint(condition=~Q(status="approved") | Q(approved_at__isnull=False), name="chk_milestone_approved_dated")]
