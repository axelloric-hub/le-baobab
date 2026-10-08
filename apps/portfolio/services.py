from __future__ import annotations

from django.db import IntegrityError, transaction

from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.portfolio.models import Achievement, CertificateEntry, Education, Experience, Portfolio, Project, ProjectLink, Repository


def ensure_portfolio(user) -> Portfolio:
    return Portfolio.objects.get_or_create(user=user, defaults={"visibility": user.privacy.portfolio_visibility})[0]


@transaction.atomic
def create_project(user, *, slug: str, title: str, description: str = "", role: str = "", started_on=None, ended_on=None, technologies=(), links: list[dict] | None = None) -> Project:
    portfolio = ensure_portfolio(user)
    try:
        with transaction.atomic():
            project = Project.objects.create(portfolio=portfolio, slug=slug, title=title, description=description, role=role, started_on=started_on, ended_on=ended_on,
                                             position=portfolio.projects.count())
            ProjectLink.objects.bulk_create([ProjectLink(project=project, **l) for l in (links or [])])
    except IntegrityError as exc:
        raise DomainError("Slug deja utilise, dates incoherentes ou lien non https.", code="invalid_project") from exc
    project.technologies.set(technologies)
    return project


def _owned(user, obj):
    if obj.portfolio.user_id != user.pk:
        raise PermissionDeniedError("Ce projet ne vous appartient pas.")


@transaction.atomic
def add_project_link(user, project_id, *, kind: str, url: str, provider: str = "") -> ProjectLink:
    project = Project.objects.select_related("portfolio").get(pk=project_id)
    _owned(user, project)
    try:
        with transaction.atomic():
            return ProjectLink.objects.create(project=project, kind=kind, url=url, provider=provider)
    except IntegrityError as exc:
        raise DomainError("Lien deja present ou non https.", code="invalid_link") from exc


@transaction.atomic
def register_repository(user, *, provider: str, full_name: str, url: str, **extra) -> Repository:
    if provider not in ("github", "gitlab"):
        raise DomainError("Fournisseur de depot inconnu (github ou gitlab).", code="invalid_provider")
    try:
        with transaction.atomic():
            repo, _ = Repository.objects.update_or_create(user=user, provider=provider, full_name=full_name, defaults={"url": url, **extra})
            return repo
    except IntegrityError as exc:
        raise DomainError("Depot invalide (URL ou nom).", code="invalid_repository") from exc


def _dated(model, user, **fields):
    try:
        with transaction.atomic():
            return model.objects.create(user=user, **fields)
    except IntegrityError as exc:
        raise DomainError("La date de fin precede la date de debut.", code="invalid_dates") from exc


def add_experience(user, **fields) -> Experience:
    return _dated(Experience, user, **fields)


def add_education(user, **fields) -> Education:
    return _dated(Education, user, **fields)


def add_achievement(user, **fields) -> Achievement:
    return Achievement.objects.create(user=user, **fields)


@transaction.atomic
def add_platform_certificate(user, certificate_id) -> CertificateEntry:
    """Affiche un certificat LE BAOBAB : il doit appartenir a l'utilisateur et etre valide (ni revoque). Ainsi 'verifiable' ne se falsifie pas."""
    from apps.progress.models import Certificate

    cert = Certificate.objects.select_related("course").filter(pk=certificate_id, user=user, revoked_at__isnull=True).first()
    if cert is None:
        raise PermissionDeniedError("Certificat introuvable, revoque ou appartenant a quelqu'un d'autre.", code="invalid_certificate")
    if CertificateEntry.objects.filter(user=user, platform_certificate_ref=cert.pk).exists():
        raise ConflictError("Certificat deja ajoute.", code="duplicate")
    return CertificateEntry.objects.create(user=user, name=cert.course.title, issuer="LE BAOBAB", issued_on=cert.issued_at.date(), platform_certificate_ref=cert.pk,
                                           credential_url=f"/verify/{cert.verification_code}")
