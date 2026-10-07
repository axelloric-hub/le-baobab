"""Chiffrement applicatif (Fernet) pour les tokens OAuth tiers stockes en base."""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEY est requis pour EncryptedTextField")
    return Fernet(key.encode())


class EncryptedTextField(models.TextField):
    """Chiffre a l'ecriture, dechiffre a la lecture. Non filtrable/indexable (voulu)."""

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        return _fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        try:
            return _fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            return None
