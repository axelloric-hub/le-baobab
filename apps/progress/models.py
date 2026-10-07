"""Progression : UNE table de verite (ChapterProgress). Module/cours = calcul SQL (fonctions baobab_module_progress /
baobab_course_progress) : pas de compteurs derives a maintenir, donc aucune derive possible.
Certificats : unicite (un certificat valide par utilisateur et par cours), code public de verification, journal des verifications."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class ChapterProgress(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "En cours"
        COMPLETED = "completed", "Termine"

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="chapter_progress")
    chapter = models.ForeignKey("education.Chapter", on_delete=models.CASCADE, related_name="progress")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    percent = models.PositiveSmallIntegerField(default=0)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "progress_chapter_progress"
        constraints = [models.UniqueConstraint(fields=["user", "chapter"], name="uniq_chapter_progress"),
                       models.CheckConstraint(condition=Q(percent__lte=100), name="chk_progress_percent"),
                       models.CheckConstraint(condition=~Q(status="completed") | Q(completed_at__isnull=False, percent=100), name="chk_progress_completed")]
        indexes = [models.Index(fields=["user", "chapter"], name="chprogress_done_idx", condition=Q(status="completed"))]


class CertificateTemplate(UUIDModel):
    name = models.CharField(max_length=100, unique=True)
    body = models.TextField()  # texte avec {student}, {course}, {date}, {code}
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "progress_certificate_template"


class Certificate(UUIDModel):
    user = models.ForeignKey(U, on_delete=models.PROTECT, related_name="certificates")
    course = models.ForeignKey("education.Course", on_delete=models.PROTECT, related_name="certificates")
    template = models.ForeignKey(CertificateTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    verification_code = models.CharField(max_length=20, unique=True)
    score_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    issued_at = models.DateTimeField(default=timezone.now, editable=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "progress_certificate"
        constraints = [models.UniqueConstraint(fields=["user", "course"], condition=Q(revoked_at__isnull=True), name="uniq_certificate_active")]


class CertificateVerification(models.Model):
    """Journal des verifications publiques (employeur qui controle un certificat)."""

    id = models.BigAutoField(primary_key=True)
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE, related_name="verifications")
    verified_at = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "progress_certificate_verification"
        indexes = [models.Index(fields=["certificate", "-verified_at"], name="certverif_cert_idx")]
