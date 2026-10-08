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


# ------------------------------------------------------------------ edition du profil (appele par l'API)
from django.utils import timezone as _tz  # noqa: E402

from apps.core.exceptions import DomainError as _DomainError  # noqa: E402
from apps.profiles.models import Country, Interest, Profession, Skill  # noqa: E402

PROFILE_FIELDS = ("display_name", "headline", "bio", "region", "city", "languages", "availability")


def _swap_file(old_key: str, new_file) -> str:
    """Remplace une cle de fichier (avatar/couverture) : l'ancien objet est supprime du bucket. new_file : StoredFile, None (effacer) ou ... (inchange)."""
    from apps.storage.models import StoredFile
    from apps.storage.services import delete_file

    if new_file is ...:
        return old_key
    if old_key:
        old = StoredFile.objects.filter(key=old_key, status="uploaded").first()
        if old is not None and (new_file is None or old.pk != new_file.pk):
            delete_file(old.owner, old.pk)
    return "" if new_file is None else new_file.key


@transaction.atomic
def update_profile(user, *, fields: dict, avatar=..., cover=..., country_code=..., profession_slug=...) -> Profile:
    profile = Profile.objects.select_for_update().get(pk=user.pk)
    for name in PROFILE_FIELDS:
        if name in fields:
            setattr(profile, name, fields[name])
    if country_code is not ...:
        profile.country = None if country_code is None else Country.objects.filter(code=country_code.upper()).first() or _raise("Pays inconnu.", "invalid_country")
    if profession_slug is not ...:
        profile.profession = None if profession_slug is None else Profession.objects.filter(slug=profession_slug).first() or _raise("Metier inconnu.", "invalid_profession")
    profile.avatar_key = _swap_file(profile.avatar_key, avatar)
    profile.cover_key = _swap_file(profile.cover_key, cover)
    profile.updated_at = _tz.now()
    profile.save()
    return profile


def _raise(message: str, code: str):
    raise _DomainError(message, code=code)


@transaction.atomic
def replace_skills(user, items: list[dict]) -> None:
    """items = [{"slug", "level", "years_experience"?}] : remplace la liste complete (idempotent)."""
    slugs = [i["slug"] for i in items]
    if len(set(slugs)) != len(slugs):
        raise _DomainError("Competence en double.", code="duplicate_skill")
    skills = {s.slug: s for s in Skill.objects.filter(slug__in=slugs, is_active=True)}
    missing = set(slugs) - set(skills)
    if missing:
        raise _DomainError(f"Competence(s) inconnue(s) : {', '.join(sorted(missing))}.", code="unknown_skill")
    UserSkill.objects.filter(user=user).delete()
    UserSkill.objects.bulk_create([UserSkill(user=user, skill=skills[i["slug"]], level=i["level"], years_experience=i.get("years_experience")) for i in items])


@transaction.atomic
def replace_interests(user, slugs: list[str]) -> None:
    found = {i.slug: i for i in Interest.objects.filter(slug__in=slugs, is_active=True)}
    if set(slugs) - set(found):
        raise _DomainError("Centre d'interet inconnu.", code="unknown_interest")
    UserInterest.objects.filter(user=user).delete()
    UserInterest.objects.bulk_create([UserInterest(user=user, interest=found[s]) for s in dict.fromkeys(slugs)])


def add_social_link(user, *, provider: str, url: str, handle: str = "") -> SocialLink:
    from django.db import IntegrityError

    try:
        with transaction.atomic():
            return SocialLink.objects.get_or_create(user=user, provider=provider, url=url, defaults={"handle": handle})[0]
    except IntegrityError as exc:
        raise _DomainError("Lien invalide.", code="invalid_link") from exc


def update_privacy(user, **fields) -> PrivacySettings:
    PrivacySettings.objects.filter(pk=user.pk).update(**fields, updated_at=_tz.now())
    return PrivacySettings.objects.get(pk=user.pk)


def update_preferences(user, **fields) -> UserPreferences:
    UserPreferences.objects.filter(pk=user.pk).update(**fields, updated_at=_tz.now())
    return UserPreferences.objects.get(pk=user.pk)
