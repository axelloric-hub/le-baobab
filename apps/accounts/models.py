"""Identite et securite du compte. Source de verite : PostgreSQL.
Les sessions API sont des JWT (refresh rotatif + blacklist : tables simplejwt) ; Redis ne sert qu'aux OTP/presence."""
from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.core.models import UUIDModel

USERNAME_RE = r"^[a-z0-9][a-z0-9_.]{2,29}$"


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def _create(self, email: str, username: str, password: str | None, **extra) -> "User":
        if not email or not username:
            raise ValueError("email et username sont obligatoires")
        user = self.model(email=self.normalize_email(email).lower(), username=username.lower(), **extra)
        user.set_password(password)
        user.full_clean(exclude=["password"], validate_unique=False)  # l'unicite est arbitree par la base (sans course)
        user.save(using=self._db)
        return user

    def create_user(self, email, username, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, username, password, **extra)

    def create_superuser(self, email, username, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, status=User.Status.ACTIVE, email_verified_at=timezone.now())
        return self._create(email, username, password, **extra)


class User(UUIDModel, AbstractBaseUser, PermissionsMixin):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente de verification"
        ACTIVE = "active", "Actif"
        SUSPENDED = "suspended", "Suspendu"
        DEACTIVATED = "deactivated", "Desactive par l'utilisateur"
        DELETED = "deleted", "Supprime"
        ANONYMIZED = "anonymized", "Anonymise"

    email = models.EmailField(max_length=254, unique=True)  # stocke en minuscules (CHECK ci-dessous) => unicite insensible a la casse
    username = models.CharField(
        max_length=30, unique=True, validators=[RegexValidator(USERNAME_RE, "3-30 caracteres : a-z, 0-9, _ et .")]
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    suspended_until = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.CharField(max_length=255, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    anonymized_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "accounts_user"
        constraints = [
            # Unicite insensible a la casse garantie PAR LA BASE : valeur forcee en minuscules + UNIQUE.
            # (username est deja contraint a [a-z0-9_.] par le CHECK de format.)
            models.CheckConstraint(condition=models.Q(email=Lower("email")), name="chk_user_email_lower"),
            models.CheckConstraint(condition=models.Q(username__regex=USERNAME_RE), name="chk_user_username_format"),
            models.CheckConstraint(
                condition=~models.Q(status="suspended") | models.Q(suspended_until__isnull=False) | models.Q(suspension_reason__gt=""),
                name="chk_user_suspension_documented",
            ),
        ]
        indexes = [
            # Operations de moderation / admin : "tous les comptes non actifs". Partiel => minuscule.
            models.Index(fields=["status", "date_joined"], name="user_nonactive_idx", condition=~models.Q(status="active")),
            models.Index(fields=["-date_joined"], name="user_joined_idx"),  # stats "nouveaux utilisateurs"
        ]

    # `is_active` pilote l'authentification Django : derive du statut, jamais editable a part.
    @property
    def is_active(self) -> bool:  # type: ignore[override]
        return self.status in {self.Status.ACTIVE, self.Status.PENDING}

    def __str__(self) -> str:
        return f"@{self.username}"


class SecuritySettings(models.Model):
    user = models.OneToOneField(User, primary_key=True, on_delete=models.CASCADE, related_name="security")
    two_factor_enabled = models.BooleanField(default=False)
    login_alerts = models.BooleanField(default=True)
    active_session_limit = models.PositiveSmallIntegerField(default=10)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "accounts_security_settings"


class Device(UUIDModel):
    class Platform(models.TextChoices):
        WEB = "web", "Web"
        ANDROID = "android", "Android"
        IOS = "ios", "iOS"
        DESKTOP = "desktop", "Desktop"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    fingerprint = models.CharField(max_length=128)  # identifiant stable cote client (hash)
    platform = models.CharField(max_length=10, choices=Platform.choices)
    label = models.CharField(max_length=100, blank=True)
    push_token = models.CharField(max_length=512, blank=True)
    is_trusted = models.BooleanField(default=False)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_device"
        constraints = [models.UniqueConstraint(fields=["user", "fingerprint"], name="uniq_device_user_fp")]
        indexes = [
            # Envoi de push : seulement les appareils avec token et non revoques.
            models.Index(fields=["user"], name="device_pushable_idx", condition=~models.Q(push_token="") & models.Q(revoked_at__isnull=True))
        ]


class LoginHistory(models.Model):
    """Journal des connexions reussies/echouees d'un utilisateur connu. Table append-only,
    candidate au partitionnement par mois (voir SCALABILITY.md)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_history")
    device = models.ForeignKey(Device, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    success = models.BooleanField()
    method = models.CharField(max_length=20, default="password")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    country_code = models.CharField(max_length=2, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "accounts_login_history"
        indexes = [models.Index(fields=["user", "-created_at"], name="loginhist_user_idx")]


class LoginAttempt(models.Model):
    """Tentatives par identifiant (meme inconnu) pour detection de brute force. Le comptage temps reel
    se fait dans Redis (rate_limit) ; cette table conserve la trace d'investigation (BRIN : append-only)."""

    id = models.BigAutoField(primary_key=True)
    identifier = models.CharField(max_length=254)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    success = models.BooleanField(default=False)
    reason = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "accounts_login_attempt"
        indexes = [
            models.Index(fields=["identifier", "-created_at"], name="loginatt_ident_idx"),
            models.Index(fields=["ip_address", "-created_at"], name="loginatt_ip_idx"),
        ]


class EmailOTP(models.Model):
    """Code a usage unique envoye par e-mail. Seul le HACHAGE (HMAC) est stocke : un vol de base ne revele aucun code valide."""

    class Purpose(models.TextChoices):
        VERIFY_EMAIL = "verify_email", "Confirmation du compte"
        RESET_PASSWORD = "reset_password", "Mot de passe oublie"

    id = models.BigAutoField(primary_key=True)
    email = models.EmailField(max_length=254)
    purpose = models.CharField(max_length=16, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    emailed = models.BooleanField(default=False)  # le message est-il reellement parti ? (alimente le plafond quotidien)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "accounts_email_otp"
        indexes = [models.Index(fields=["email", "purpose", "-created_at"], name="otp_lookup_idx"),
                   models.Index(fields=["created_at"], name="otp_emailed_day_idx", condition=models.Q(emailed=True))]
