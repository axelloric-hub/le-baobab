"""Aides de test d'API : client authentifie en une ligne (inscription -> OTP -> jetons), sans passer par la messagerie."""
from __future__ import annotations

from rest_framework.test import APIClient

from apps.core.testing import make_user


def api_client(user=None) -> APIClient:
    """Client anonyme, ou authentifie par un VRAI jeton JWT emis pour `user` (meme chemin de code qu'en production)."""
    from rest_framework_simplejwt.tokens import RefreshToken

    c = APIClient()
    if user is not None:
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return c


def verified_user(username: str | None = None):
    """Utilisateur deja confirme et actif (make_user cree un compte 'pending' : on le confirme comme le ferait l'OTP)."""
    from django.utils import timezone

    u = make_user(username)
    u.status, u.email_verified_at = "active", timezone.now()
    u.save(update_fields=["status", "email_verified_at"])
    return u


def upload_file(client, purpose="avatar", content_type="image/png", size=1000, filename="f.png") -> str:
    """Parcours reel d'un envoi : demande d'URL signee -> (le client envoie au bucket : simule) -> confirmation. Retourne l'identifiant du fichier."""
    from apps.storage.backends import FakeBackend
    from apps.storage.models import StoredFile

    up = client.post("/api/v1/files/uploads/", {"purpose": purpose, "filename": filename, "content_type": content_type, "size_bytes": size}, format="json").json()
    FakeBackend.simulate_upload(StoredFile.objects.get(pk=up["file_id"]).key, size, content_type)
    assert client.post(f"/api/v1/files/{up['file_id']}/complete/").status_code == 200
    return up["file_id"]
