"""Profil public, referentiels (competences, interets, metiers, pays), preferences et confidentialite.
Referentiels = vocabulaire partage par jobs, formations, publicite et recommandations (une seule
verite pour 'Python' ou 'Cameroun'). Technology == Skill(kind=technology) : pas de double referentiel."""
from __future__ import annotations

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils import timezone

from apps.core.choices import Visibility
from apps.core.models import UUIDModel


class Country(models.Model):
    code = models.CharField(max_length=2, primary_key=True)  # ISO 3166-1 alpha-2
    name = models.CharField(max_length=100)
    region = models.CharField(max_length=40, blank=True)  # ex: Afrique centrale
    is_african = models.BooleanField(default=False)

    class Meta:
        db_table = "profiles_country"
        verbose_name_plural = "countries"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Skill(UUIDModel):
    class Kind(models.TextChoices):
        LANGUAGE = "language", "Langage"
        FRAMEWORK = "framework", "Framework / librairie"
        TOOL = "tool", "Outil / plateforme"
        DOMAIN = "domain", "Domaine (ML, DevOps...)"
        SOFT = "soft", "Transversale"

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.TOOL)
    is_technology = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "profiles_skill"
        indexes = [GinIndex(fields=["name"], name="skill_name_trgm", opclasses=["gin_trgm_ops"])]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Interest(UUIDModel):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "profiles_interest"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Profession(UUIDModel):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "profiles_profession"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Profile(models.Model):
    """1-1 avec User, PK = user_id (pas de jointure d'identifiant supplementaire)."""

    class Availability(models.TextChoices):
        NONE = "none", "Non precise"
        OPEN_TO_WORK = "open_to_work", "Ouvert aux opportunites"
        FREELANCE = "freelance", "Disponible en freelance"
        HIRING = "hiring", "Recrute"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=80)
    headline = models.CharField(max_length=160, blank=True)
    bio = models.TextField(max_length=2000, blank=True)
    avatar_key = models.CharField(max_length=300, blank=True)  # cle de stockage objet (Supabase Storage / S3), jamais l'URL
    cover_key = models.CharField(max_length=300, blank=True)
    country = models.ForeignKey(Country, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    region = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    languages = ArrayField(models.CharField(max_length=8), default=list, blank=True)  # codes BCP-47 (fr, en, sw...)
    profession = models.ForeignKey(Profession, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    availability = models.CharField(max_length=14, choices=Availability.choices, default=Availability.NONE)
    is_verified = models.BooleanField(default=False)  # badge de verification d'identite/pro
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "profiles_profile"
        constraints = [
            models.CheckConstraint(condition=~models.Q(display_name=""), name="chk_profile_display_name_nonempty"),
            models.CheckConstraint(
                condition=models.Q(is_verified=False) | models.Q(verified_at__isnull=False), name="chk_profile_verified_dated"
            ),
        ]
        indexes = [
            # Recherche "Ahmed" / "ahm" : trigramme (ILIKE '%x%') impossible avec un B-tree.
            GinIndex(fields=["display_name"], name="profile_name_trgm", opclasses=["gin_trgm_ops"]),
            models.Index(fields=["country", "availability"], name="profile_country_avail_idx"),
            GinIndex(fields=["languages"], name="profile_languages_gin"),
        ]

    def __str__(self) -> str:
        return self.display_name


class UserSkill(UUIDModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_skills")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="user_skills")
    level = models.PositiveSmallIntegerField(default=1)
    years_experience = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "profiles_user_skill"
        constraints = [
            models.UniqueConstraint(fields=["user", "skill"], name="uniq_userskill"),
            models.CheckConstraint(condition=models.Q(level__gte=1, level__lte=5), name="chk_userskill_level"),
            models.CheckConstraint(
                condition=models.Q(years_experience__isnull=True) | models.Q(years_experience__gte=0), name="chk_userskill_years"
            ),
        ]
        # (skill, user) : "tous les devs Django" (jobs/pub) ; (user, skill) est deja couvert par l'unique.
        indexes = [models.Index(fields=["skill", "level"], name="userskill_skill_level_idx")]


class UserInterest(UUIDModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_interests")
    interest = models.ForeignKey(Interest, on_delete=models.CASCADE, related_name="user_interests")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "profiles_user_interest"
        constraints = [models.UniqueConstraint(fields=["user", "interest"], name="uniq_userinterest")]
        indexes = [models.Index(fields=["interest"], name="userinterest_interest_idx")]


class SocialLink(UUIDModel):
    class Provider(models.TextChoices):
        GITHUB = "github", "GitHub"
        GITLAB = "gitlab", "GitLab"
        LINKEDIN = "linkedin", "LinkedIn"
        TIKTOK = "tiktok", "TikTok"
        YOUTUBE = "youtube", "YouTube"
        X = "x", "X"
        WEBSITE = "website", "Site web"
        PORTFOLIO = "portfolio", "Portfolio"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="social_links")
    provider = models.CharField(max_length=12, choices=Provider.choices)
    url = models.URLField(max_length=300)
    handle = models.CharField(max_length=100, blank=True)
    is_verified = models.BooleanField(default=False)  # prouve via OAuth (integrations.ExternalAccount)

    class Meta:
        db_table = "profiles_social_link"
        constraints = [models.UniqueConstraint(fields=["user", "provider", "url"], name="uniq_sociallink")]
        indexes = [models.Index(fields=["user"], name="sociallink_user_idx")]


class UserPreferences(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="preferences")
    language = models.CharField(max_length=8, default="fr")
    time_zone = models.CharField(max_length=64, default="Africa/Douala")  # nomme time_zone : evite d'ombrer le module timezone
    theme = models.CharField(max_length=10, default="system")
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "profiles_preferences"
        constraints = [models.CheckConstraint(condition=models.Q(theme__in=["system", "light", "dark"]), name="chk_pref_theme")]


class PrivacySettings(models.Model):
    """Controle de la confidentialite. Lu par TOUTES les verifications de visibilite (cache Redis 10 min)."""

    class Contact(models.TextChoices):
        EVERYONE = "everyone", "Tout le monde"
        FRIENDS = "friends", "Amis"
        NOBODY = "nobody", "Personne"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="privacy")
    profile_visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.PUBLIC)
    portfolio_visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.PUBLIC)
    default_post_visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.PUBLIC)
    default_status_visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.FRIENDS)
    activity_visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.FRIENDS)
    who_can_message = models.CharField(max_length=10, choices=Contact.choices, default=Contact.EVERYONE)
    who_can_send_friend_request = models.CharField(max_length=10, choices=Contact.choices, default=Contact.EVERYONE)
    show_presence = models.BooleanField(default=True)
    show_read_receipts = models.BooleanField(default=True)
    searchable = models.BooleanField(default=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "profiles_privacy"
