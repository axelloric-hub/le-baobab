"""Registre des fichiers. Le bucket est PRIVE ; chaque objet y a une ligne ici (proprietaire, usage, taille). Le client ne choisit JAMAIS la cle :
elle est generee par le serveur ('<usage>/<id proprietaire>/<uuid>/<nom>'), donc l'isolation entre comptes est structurelle."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel


class StoredFile(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Envoi en attente"
        UPLOADED = "uploaded", "Envoye et verifie"
        DELETED = "deleted", "Supprime"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="stored_files")
    purpose = models.CharField(max_length=24)
    key = models.CharField(max_length=500, unique=True)
    filename = models.CharField(max_length=200)
    content_type = models.CharField(max_length=100)
    size_bytes = models.BigIntegerField()
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    uploaded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "storage_file"
        constraints = [models.CheckConstraint(condition=Q(size_bytes__gt=0), name="chk_file_size"),
                       models.CheckConstraint(condition=~Q(status="uploaded") | Q(uploaded_at__isnull=False), name="chk_file_uploaded_dated")]
        indexes = [models.Index(fields=["owner", "-created_at"], name="file_owner_idx"),
                   models.Index(fields=["created_at"], name="file_pending_idx", condition=Q(status="pending"))]
