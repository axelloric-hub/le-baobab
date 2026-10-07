"""Contenus et comptes externes. Principes de conformite :
 - tokens OAuth chiffres (Fernet) et revocables ; scopes minimaux consignes ;
 - on ne stocke que les metadonnees autorisees par les CGU du fournisseur, avec `expires_at` => rafraichissement/suppression
   (ex: TikTok impose de ne pas conserver indefiniment les donnees) ;
 - affichage via oEmbed/iframe officiel uniquement (hotes en liste blanche, voir constants.ALLOWED_EMBED_HOSTS)."""
from __future__ import annotations

from urllib.parse import urlparse

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.encryption import EncryptedTextField
from apps.core.models import UUIDModel
from apps.integrations.constants import ALLOWED_EMBED_HOSTS

U = settings.AUTH_USER_MODEL


class ExternalProvider(models.Model):
    code = models.CharField(max_length=20, primary_key=True)  # github, gitlab, tiktok, youtube, linkedin
    name = models.CharField(max_length=60)
    supports_oauth = models.BooleanField(default=False)
    supports_embed = models.BooleanField(default=False)
    terms_url = models.URLField(blank=True)
    max_cache_hours = models.PositiveIntegerField(default=24)  # duree max de conservation des metadonnees (CGU)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "integrations_provider"

    def __str__(self) -> str:
        return self.name


class ExternalAccount(UUIDModel):
    """Compte tiers lie par OAuth (consentement explicite de l'utilisateur)."""

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="external_accounts")
    provider = models.ForeignKey(ExternalProvider, on_delete=models.PROTECT, related_name="+")
    external_id = models.CharField(max_length=100)
    handle = models.CharField(max_length=100, blank=True)
    access_token = EncryptedTextField(blank=True)
    refresh_token = EncryptedTextField(blank=True)
    scopes = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    connected_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "integrations_account"
        constraints = [
            models.UniqueConstraint(fields=["provider", "external_id"], name="uniq_extaccount_identity"),  # 1 compte tiers = 1 utilisateur
            models.UniqueConstraint(fields=["user", "provider"], condition=Q(revoked_at__isnull=True), name="uniq_extaccount_user_active"),
        ]


class ExternalAuthor(UUIDModel):
    provider = models.ForeignKey(ExternalProvider, on_delete=models.PROTECT, related_name="+")
    external_id = models.CharField(max_length=100)
    handle = models.CharField(max_length=100, blank=True)
    display_name = models.CharField(max_length=150, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)
    profile_url = models.URLField(max_length=500, blank=True)
    fetched_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "integrations_author"
        constraints = [models.UniqueConstraint(fields=["provider", "external_id"], name="uniq_extauthor")]


class ExternalContent(UUIDModel):
    class Kind(models.TextChoices):
        VIDEO = "video", "Video"
        REPOSITORY = "repository", "Depot"
        PROFILE = "profile", "Profil"
        POST = "post", "Publication"

    class Status(models.TextChoices):
        ACTIVE = "active", "Disponible"
        UNAVAILABLE = "unavailable", "Indisponible (supprime/prive cote fournisseur)"

    provider = models.ForeignKey(ExternalProvider, on_delete=models.PROTECT, related_name="contents")
    external_id = models.CharField(max_length=150)
    kind = models.CharField(max_length=12, choices=Kind.choices)
    author = models.ForeignKey(ExternalAuthor, null=True, blank=True, on_delete=models.SET_NULL, related_name="contents")
    canonical_url = models.URLField(max_length=600)
    title = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    thumbnail_url = models.URLField(max_length=600, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # reponse API reduite aux champs necessaires
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    fetched_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()  # a rafraichir ou supprimer avant cette date

    class Meta:
        db_table = "integrations_content"
        constraints = [models.UniqueConstraint(fields=["provider", "external_id"], name="uniq_extcontent")]
        indexes = [models.Index(fields=["expires_at"], name="extcontent_expiry_idx", condition=Q(status="active")),
                   models.Index(fields=["provider", "kind", "-published_at"], name="extcontent_browse_idx")]


class ExternalVideo(models.Model):
    content = models.OneToOneField(ExternalContent, primary_key=True, on_delete=models.CASCADE, related_name="video")
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "integrations_video"


class EmbedMetadata(models.Model):
    """Donnees d'embed OFFICIEL (oEmbed). `embed_url` est valide contre la liste blanche ; le HTML tiers n'est jamais rendu tel quel."""

    content = models.OneToOneField(ExternalContent, primary_key=True, on_delete=models.CASCADE, related_name="embed")
    embed_url = models.URLField(max_length=700)
    oembed_version = models.CharField(max_length=10, default="1.0")
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "integrations_embed"

    def clean(self) -> None:
        provider = self.content.provider_id
        host = urlparse(self.embed_url).hostname or ""
        if urlparse(self.embed_url).scheme != "https" or host not in ALLOWED_EMBED_HOSTS.get(provider, ()):
            raise ValidationError({"embed_url": f"Hote d'embed non autorise pour {provider}."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class SyncState(models.Model):
    class Status(models.TextChoices):
        IDLE = "idle", "Au repos"
        RUNNING = "running", "En cours"
        ERROR = "error", "Erreur"

    id = models.BigAutoField(primary_key=True)
    provider = models.ForeignKey(ExternalProvider, on_delete=models.CASCADE, related_name="+")
    account = models.ForeignKey(ExternalAccount, null=True, blank=True, on_delete=models.CASCADE, related_name="sync_states")
    resource = models.CharField(max_length=40)  # repositories, videos...
    cursor = models.CharField(max_length=300, blank=True)
    etag = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.IDLE)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    next_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    rate_limit_reset_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "integrations_sync_state"
        constraints = [models.UniqueConstraint(fields=["provider", "account", "resource"], name="uniq_syncstate", nulls_distinct=False)]
        indexes = [models.Index(fields=["next_sync_at"], name="syncstate_due_idx", condition=~Q(status="running"))]
