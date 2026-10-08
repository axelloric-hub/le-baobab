"""Fichiers : l'API ne voit JAMAIS le contenu. Elle delivre une URL signee d'ENVOI (le client envoie directement au bucket), verifie l'envoi,
puis delivre des URL signees de LECTURE a duree courte apres controle d'acces."""
from __future__ import annotations

from rest_framework import serializers as s
from rest_framework.response import Response

from apps.core.api import endpoint, get_or_404, paginate
from apps.storage import services as F
from apps.storage.models import StoredFile


def _file(f: StoredFile) -> dict:
    return {"id": str(f.pk), "purpose": f.purpose, "filename": f.filename, "content_type": f.content_type, "size_bytes": f.size_bytes, "status": f.status, "created_at": f.created_at}


@endpoint("Demander une URL signee pour ENVOYER un fichier directement au bucket (PUT). Le type et la taille declares sont signes : le bucket refuse tout ecart.",
          status=201, body={"purpose": s.ChoiceField(choices=sorted(F.PURPOSES)), "filename": s.CharField(max_length=200), "content_type": s.CharField(max_length=100),
                            "size_bytes": s.IntegerField(min_value=1)})
def request_upload(request):
    d = request.input
    _, upload = F.request_upload(request.user, purpose=d["purpose"], filename=d["filename"], content_type=d["content_type"], size_bytes=d["size_bytes"])
    return upload


@endpoint("Confirmer l'envoi : le serveur verifie dans le bucket l'existence, la taille et le type du fichier.")
def complete_upload(request, file_id):
    return _file(F.complete_upload(request.user, file_id))


@endpoint("Mes fichiers.", query={"purpose": s.CharField(required=False)})
def my_files(request):
    qs = StoredFile.objects.filter(owner=request.user).exclude(status="deleted")
    if request.q.get("purpose"):
        qs = qs.filter(purpose=request.q["purpose"])
    return paginate(request, qs, ("-created_at", "-id"), _file)


@endpoint("URL signee de LECTURE (duree courte). Proprietaire, ou tout le monde pour un usage public (avatar, logo...). Sinon 404.", auth="optional")
def file_url(request, file_id):
    url = F.download_url(request.user, file_id)
    if url is None:
        get_or_404(StoredFile.objects.none())
    return {"url": url, "expires_in": 300}


@endpoint("Supprimer un de mes fichiers (supprime aussi l'objet du bucket).", status=204)
def delete_file(request, file_id):
    F.delete_file(request.user, file_id)
    return Response(status=204)


@endpoint("Usages de fichiers autorises (types et tailles maximales).", auth="public")
def purposes(request):
    return [{"purpose": k, "allowed_types": sorted(t), "max_size_bytes": m, "public": pub} for k, (t, m, pub) in sorted(F.PURPOSES.items())]
