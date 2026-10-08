from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.core import redis as R
from apps.core.exceptions import DomainError, RateLimitedError
from apps.storage.backends import get_backend
from apps.storage.models import StoredFile

MB = 1024 * 1024
IMG = {"image/jpeg", "image/png", "image/webp", "image/gif"}
VIDEO = {"video/mp4", "video/webm"}
AUDIO = {"audio/mpeg", "audio/ogg", "audio/wav"}
PDF = {"application/pdf"}
ZIP = {"application/zip", "application/x-zip-compressed"}
OFFICE = PDF | {"application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
# usage -> (types autorises, taille max, public ?). SVG/HTML/JS sont VOLONTAIREMENT absents (XSS par fichier).
PURPOSES: dict[str, tuple[set, int, bool]] = {
    "avatar": (IMG, 5 * MB, True), "cover": (IMG, 10 * MB, True),
    "company_logo": (IMG, 5 * MB, True), "company_cover": (IMG, 10 * MB, True),
    "product_media": (IMG | VIDEO, 100 * MB, True), "ad_creative": (IMG | VIDEO, 50 * MB, True),
    "post_media": (IMG | VIDEO | AUDIO | PDF, 100 * MB, False), "status_media": (IMG | VIDEO | AUDIO, 50 * MB, False),
    "message_attachment": (IMG | VIDEO | AUDIO | PDF | ZIP, 50 * MB, False),
    "course_content": (IMG | VIDEO | AUDIO | PDF | ZIP | {"application/x-ipynb+json"}, 500 * MB, False),
    "assignment_submission": (OFFICE | ZIP | IMG, 50 * MB, False), "cv": (OFFICE, 10 * MB, False),
    "portfolio_media": (IMG | VIDEO | PDF, 100 * MB, False),
    "product_asset": (ZIP | PDF | {"application/octet-stream", "application/vnd.android.package-archive", "application/x-apple-diskimage"}, 1024 * MB, False),
}


def safe_filename(name: str) -> str:
    name = unicodedata.normalize("NFKD", name.replace("\\", "/").split("/")[-1])
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or "fichier"
    return name[-120:]


def is_public(purpose: str) -> bool:
    return PURPOSES.get(purpose, (None, 0, False))[2]


def request_upload(user, *, purpose: str, filename: str, content_type: str, size_bytes: int) -> tuple[StoredFile, dict]:
    if purpose not in PURPOSES:
        raise DomainError("Usage de fichier inconnu.", code="invalid_purpose")
    types, max_size, _ = PURPOSES[purpose]
    if content_type not in types:
        raise DomainError(f"Type de fichier non autorise pour « {purpose} ».", code="invalid_content_type")
    if not 0 < size_bytes <= max_size:
        raise DomainError(f"Taille invalide (maximum {max_size // MB} Mo pour « {purpose} »).", code="invalid_size")
    allowed, _, _ = R.rate_limit("upload_request", user.pk, 60, 3600)
    if not allowed:
        raise RateLimitedError("Trop de demandes d'envoi, reessayez plus tard.")
    used = StoredFile.objects.filter(owner=user).exclude(status="deleted").aggregate(s=Sum("size_bytes"))["s"] or 0
    if used + size_bytes > settings.USER_STORAGE_QUOTA_BYTES:
        raise DomainError("Quota de stockage depasse.", code="quota_exceeded")
    key = f"{purpose}/{user.pk}/{uuid.uuid4()}/{safe_filename(filename)}"
    f = StoredFile.objects.create(owner=user, purpose=purpose, key=key, filename=safe_filename(filename), content_type=content_type, size_bytes=size_bytes)
    url, headers = get_backend().presign_put(key, content_type, size_bytes, settings.STORAGE_UPLOAD_URL_TTL)
    return f, {"file_id": str(f.pk), "method": "PUT", "url": url, "headers": headers, "expires_in": settings.STORAGE_UPLOAD_URL_TTL}


def complete_upload(user, file_id) -> StoredFile:
    """Le client affirme avoir envoye le fichier : on NE LE CROIT PAS, on interroge le bucket (existence, taille, type).
    Un fichier non conforme est DETRUIT ; l'erreur est levee APRES la transaction (sinon elle annulerait la destruction)."""
    refusal = None
    with transaction.atomic():
        f = StoredFile.objects.select_for_update().get(pk=file_id, owner=user)
        if f.status == "uploaded":
            return f
        if f.status != "pending":
            refusal = ("file_unavailable", "Ce fichier n'est plus disponible.")
        else:
            head = get_backend().head(f.key)
            if head is None:
                refusal = ("upload_missing", "Fichier introuvable dans le bucket : envoyez-le avant de confirmer.")
            elif head["size"] != f.size_bytes or head["content_type"] != f.content_type:
                get_backend().delete(f.key)
                f.status = "deleted"
                f.save(update_fields=["status"])
                refusal = ("upload_mismatch", "Le fichier envoye ne correspond pas a la demande (taille ou type).")
            else:
                f.status, f.uploaded_at = "uploaded", timezone.now()
                f.save(update_fields=["status", "uploaded_at"])
    if refusal:
        raise DomainError(refusal[1], code=refusal[0])
    return f


def resolve_owned(user, file_id, purposes: tuple[str, ...]) -> StoredFile:
    """Convertit un identifiant de fichier fourni par le client en fichier DE CET UTILISATEUR, verifie et du bon usage (anti-IDOR)."""
    f = StoredFile.objects.filter(pk=file_id, owner=user, status="uploaded", purpose__in=purposes).first()
    if f is None:
        raise DomainError("Fichier invalide : il doit etre a vous, envoye, et du bon usage.", code="invalid_file")
    return f


def signed_url(key: str, filename: str | None = None) -> str:
    """URL de lecture a duree courte. L'AUTORISATION est a la charge de l'appelant (acces au cours, licence, visibilite du post...)."""
    return get_backend().presign_get(key, settings.STORAGE_DOWNLOAD_URL_TTL, filename)


def download_url(viewer, file_id) -> str | None:
    """Lecture directe : proprietaire, ou n'importe qui pour un usage public (avatar, logo...). Sinon None (-> 404)."""
    f = StoredFile.objects.filter(pk=file_id, status="uploaded").first()
    if f is None:
        return None
    if is_public(f.purpose) or (getattr(viewer, "pk", None) == f.owner_id):
        return signed_url(f.key, f.filename)
    return None


@transaction.atomic
def delete_file(user, file_id) -> None:
    f = StoredFile.objects.select_for_update().get(pk=file_id, owner=user)
    if f.status == "deleted":
        return
    get_backend().delete(f.key)
    f.status = "deleted"
    f.save(update_fields=["status"])


def expire_pending(batch: int = 200) -> int:
    """Job : les envois jamais confirmes apres 24 h sont supprimes (libere le quota et le bucket)."""
    n = 0
    for f in StoredFile.objects.filter(status="pending", created_at__lt=timezone.now() - timedelta(hours=24))[:batch]:
        try:
            get_backend().delete(f.key)
        except Exception:  # noqa: BLE001 - le nettoyage reessaiera au prochain passage
            continue
        f.status = "deleted"
        f.save(update_fields=["status"])
        n += 1
    return n
