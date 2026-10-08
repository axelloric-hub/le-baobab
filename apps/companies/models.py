"""Entreprises. CompanyRole = enumeration (owner/admin/recruiter/editor/employee), pas une table : c'est du code, pas de la donnee.
Invariant garanti par la BASE (trigger differe) : une entreprise a TOUJOURS au moins un proprietaire."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class Company(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Non verifiee"
        VERIFIED = "verified", "Verifiee"
        SUSPENDED = "suspended", "Suspendue"

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=140)
    tagline = models.CharField(max_length=200, blank=True)
    description = models.TextField(max_length=10000, blank=True)
    website = models.URLField(blank=True)
    industry = models.CharField(max_length=80, blank=True)
    size_range = models.CharField(max_length=12, blank=True)
    country = models.ForeignKey("profiles.Country", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    city = models.CharField(max_length=80, blank=True)
    logo_key = models.CharField(max_length=300, blank=True)
    cover_key = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "companies_company"
        verbose_name_plural = "companies"
        constraints = [models.CheckConstraint(condition=Q(size_range__in=["", "1-10", "11-50", "51-200", "201-1000", "1000+"]), name="chk_company_size")]
        indexes = [models.Index(fields=["country", "status"], name="company_browse_idx")]

    def __str__(self) -> str:
        return self.name


class CompanyMember(UUIDModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Proprietaire"
        ADMIN = "admin", "Administrateur"
        RECRUITER = "recruiter", "Recruteur"
        EDITOR = "editor", "Editeur"
        EMPLOYEE = "employee", "Employe"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="company_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.EMPLOYEE)
    title = models.CharField(max_length=100, blank=True)
    is_public = models.BooleanField(default=True)  # apparait sur la page publique de l'entreprise
    joined_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "companies_member"
        constraints = [models.UniqueConstraint(fields=["company", "user"], name="uniq_company_member")]
        indexes = [models.Index(fields=["user"], name="companymember_user_idx")]


class CompanyVerification(UUIDModel):
    class Method(models.TextChoices):
        DOMAIN_EMAIL = "domain_email", "E-mail du domaine"
        DOCUMENT = "document", "Document officiel"
        MANUAL = "manual", "Verification manuelle"

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        APPROVED = "approved", "Approuvee"
        REJECTED = "rejected", "Rejetee"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="verifications")
    method = models.CharField(max_length=14, choices=Method.choices)
    evidence = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    submitted_by = models.ForeignKey(U, on_delete=models.PROTECT, related_name="+")
    reviewed_by = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "companies_verification"
        constraints = [models.UniqueConstraint(fields=["company"], condition=Q(status="pending"), name="uniq_verification_pending"),
                       models.CheckConstraint(condition=Q(status="pending") | Q(reviewed_at__isnull=False), name="chk_verification_reviewed")]


class CompanySocialLink(UUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="social_links")
    provider = models.CharField(max_length=12)
    url = models.URLField(max_length=300)

    class Meta:
        db_table = "companies_social_link"
        constraints = [models.UniqueConstraint(fields=["company", "provider", "url"], name="uniq_company_social"),
                       models.CheckConstraint(condition=Q(url__startswith="https://"), name="chk_company_social_https")]


class CompanyProject(UUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=5000, blank=True)
    url = models.URLField(blank=True)
    repo_url = models.URLField(blank=True)
    skills = models.ManyToManyField("profiles.Skill", blank=True, related_name="+", db_table="companies_project_skill")
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "companies_project"


class CompanyService(UUIDModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="services")
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=3000, blank=True)
    starting_price_minor = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "companies_service"
        constraints = [models.CheckConstraint(condition=Q(starting_price_minor__isnull=True) | ~Q(currency=""), name="chk_companyservice_currency")]


class CompanyProductRef(UUIDModel):
    """Produit de la marketplace presente sur la page entreprise : REFERENCE par id (pas de FK entre domaines)."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="product_refs")
    product_ref = models.UUIDField()
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "companies_product_ref"
        constraints = [models.UniqueConstraint(fields=["company", "product_ref"], name="uniq_company_productref")]
