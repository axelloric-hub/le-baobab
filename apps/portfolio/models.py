"""Portfolio d'un developpeur. Technology == profiles.Skill (un seul referentiel). Visibilite : meme enumeration que partout (core.choices.Visibility)."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.choices import Visibility
from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class Portfolio(models.Model):
    user = models.OneToOneField(U, primary_key=True, on_delete=models.CASCADE, related_name="portfolio")
    title = models.CharField(max_length=140, blank=True)
    summary = models.TextField(max_length=3000, blank=True)
    visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.PUBLIC)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portfolio_portfolio"
        constraints = [models.CheckConstraint(condition=~Q(visibility__in=["group_members", "custom"]), name="chk_portfolio_visibility")]


class Project(UUIDModel):
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name="projects")
    slug = models.SlugField(max_length=80)
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=10000, blank=True)
    role = models.CharField(max_length=100, blank=True)
    started_on = models.DateField(null=True, blank=True)
    ended_on = models.DateField(null=True, blank=True)
    is_featured = models.BooleanField(default=False)
    position = models.PositiveSmallIntegerField(default=0)
    technologies = models.ManyToManyField("profiles.Skill", blank=True, related_name="portfolio_projects", db_table="portfolio_project_technology")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "portfolio_project"
        constraints = [models.UniqueConstraint(fields=["portfolio", "slug"], name="uniq_project_slug"),
                       models.CheckConstraint(condition=Q(ended_on__isnull=True) | Q(started_on__isnull=True) | Q(ended_on__gte=models.F("started_on")), name="chk_project_dates")]
        indexes = [models.Index(fields=["portfolio", "position"], name="project_order_idx")]


class ProjectMedia(UUIDModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=10, default="image")  # image, video, document
    storage_key = models.CharField(max_length=400)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "portfolio_project_media"
        constraints = [models.UniqueConstraint(fields=["project", "position"], name="uniq_projectmedia_position")]


class ProjectLink(UUIDModel):
    class Kind(models.TextChoices):
        DEMO = "demo", "Demo"
        REPOSITORY = "repository", "Depot"
        ARTICLE = "article", "Article"
        OTHER = "other", "Autre"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="links")
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.OTHER)
    provider = models.CharField(max_length=12, blank=True)  # github, gitlab...
    url = models.URLField(max_length=400)

    class Meta:
        db_table = "portfolio_project_link"
        constraints = [models.CheckConstraint(condition=Q(url__startswith="https://"), name="chk_projectlink_https"),
                       models.UniqueConstraint(fields=["project", "url"], name="uniq_projectlink")]


class Repository(UUIDModel):
    """Depot GitHub/GitLab affiche sur le portfolio (donnees issues des API OFFICIELLES via integrations)."""

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="repositories")
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="repositories")
    provider = models.CharField(max_length=8)
    full_name = models.CharField(max_length=200)
    url = models.URLField(max_length=400)
    description = models.CharField(max_length=500, blank=True)
    language = models.CharField(max_length=40, blank=True)
    stars = models.PositiveIntegerField(default=0)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)  # depot public confirme par l'API GitHub
    owner_verified = models.BooleanField(default=False)  # le compte GitHub lie a l'utilisateur EST le proprietaire du depot

    class Meta:
        db_table = "portfolio_repository"
        constraints = [models.UniqueConstraint(fields=["user", "provider", "full_name"], name="uniq_repository"),
                       models.CheckConstraint(condition=Q(provider__in=["github", "gitlab"]), name="chk_repository_provider")]


class Experience(UUIDModel):
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="experiences")
    company_name = models.CharField(max_length=140)
    company_ref = models.UUIDField(null=True, blank=True)  # entreprise de la plateforme, par id
    title = models.CharField(max_length=140)
    location = models.CharField(max_length=100, blank=True)
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)  # NULL = poste actuel
    description = models.TextField(max_length=5000, blank=True)

    class Meta:
        db_table = "portfolio_experience"
        constraints = [models.CheckConstraint(condition=Q(ended_on__isnull=True) | Q(ended_on__gte=models.F("started_on")), name="chk_experience_dates")]
        indexes = [models.Index(fields=["user", "-started_on"], name="experience_user_idx")]


class Education(UUIDModel):
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="educations")
    institution = models.CharField(max_length=160)
    degree = models.CharField(max_length=140, blank=True)
    field = models.CharField(max_length=140, blank=True)
    started_on = models.DateField(null=True, blank=True)
    ended_on = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "portfolio_education"
        constraints = [models.CheckConstraint(condition=Q(ended_on__isnull=True) | Q(started_on__isnull=True) | Q(ended_on__gte=models.F("started_on")), name="chk_education_dates")]


class Achievement(UUIDModel):
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="achievements")
    title = models.CharField(max_length=160)
    issuer = models.CharField(max_length=140, blank=True)
    achieved_on = models.DateField(null=True, blank=True)
    url = models.URLField(blank=True)

    class Meta:
        db_table = "portfolio_achievement"


class CertificateEntry(UUIDModel):
    """Certificat affiche sur le portfolio. Si `platform_certificate_ref` est renseigne, il est VERIFIABLE (certificat LE BAOBAB)."""

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="certificate_entries")
    name = models.CharField(max_length=160)
    issuer = models.CharField(max_length=140, blank=True)
    issued_on = models.DateField(null=True, blank=True)
    credential_url = models.URLField(blank=True)
    platform_certificate_ref = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "portfolio_certificate_entry"
