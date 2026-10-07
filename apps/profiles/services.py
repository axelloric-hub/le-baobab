from __future__ import annotations

from django.db import transaction

from apps.accounts.models import User
from apps.profiles.models import PrivacySettings, Profile, SocialLink, UserInterest, UserPreferences, UserSkill


def bootstrap_profile(user: User, display_name: str) -> Profile:
    profile = Profile.objects.create(user=user, display_name=display_name[:80])
    UserPreferences.objects.create(user=user)
    PrivacySettings.objects.create(user=user)
    return profile


@transaction.atomic
def wipe_profile(user: User) -> None:
    """Efface les donnees personnelles du profil lors de l'anonymisation."""
    Profile.objects.filter(user=user).update(
        display_name="Utilisateur supprime", headline="", bio="", avatar_key="", cover_key="",
        region="", city="", country=None, profession=None, languages=[], is_verified=False, verified_at=None,
    )
    SocialLink.objects.filter(user=user).delete()
    UserSkill.objects.filter(user=user).delete()
    UserInterest.objects.filter(user=user).delete()
    PrivacySettings.objects.filter(user=user).update(profile_visibility="private", searchable=False)
