"""Cas d'usage du domaine Comptes (la logique metier ne vit NI dans les serializers NI dans les signals)."""
from __future__ import annotations

import secrets

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import SecuritySettings, User
from apps.core.exceptions import ConflictError
from apps.core.outbox import publish_event


@transaction.atomic
def register_user(*, email: str, username: str, password: str, display_name: str | None = None) -> User:
    """Cree User + SecuritySettings + Profile + preferences par defaut, et emet UserRegistered
    dans la meme transaction (outbox). Les doublons sont arbitres par les contraintes UNIQUE."""
    from django.db import IntegrityError

    from apps.profiles.services import bootstrap_profile

    try:
        with transaction.atomic():
            user = User.objects.create_user(email=email, username=username, password=password)
    except IntegrityError as exc:
        raise ConflictError("Email ou nom d'utilisateur deja utilise.", code="duplicate_identity") from exc
    SecuritySettings.objects.create(user=user)
    bootstrap_profile(user, display_name or username)
    publish_event("UserRegistered", "user", user.pk, {"username": user.username})
    return user


@transaction.atomic
def suspend_user(*, user: User, reason: str, until=None) -> User:
    user = User.objects.select_for_update().get(pk=user.pk)
    user.status, user.suspension_reason, user.suspended_until = User.Status.SUSPENDED, reason, until
    user.save(update_fields=["status", "suspension_reason", "suspended_until"])
    publish_event("UserSuspended", "user", user.pk, {"reason": reason})
    return user


@transaction.atomic
def anonymize_user(*, user: User) -> User:
    """Droit a l'effacement : on garde la ligne (integrite referentielle des paiements/audit) mais on
    supprime toute donnee personnelle. Irreversible."""
    user = User.objects.select_for_update().get(pk=user.pk)
    token = secrets.token_hex(6)
    now = timezone.now()
    user.email, user.username = f"anonymized+{token}@deleted.invalid", f"deleted_{token}"
    user.status, user.deleted_at, user.anonymized_at = User.Status.ANONYMIZED, now, now
    user.set_unusable_password()
    user.save()
    user.devices.all().delete()
    user.login_history.all().delete()
    from apps.profiles.services import wipe_profile

    wipe_profile(user)
    publish_event("UserAnonymized", "user", user.pk)
    return user
