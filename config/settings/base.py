"""Parametres communs. Aucun secret en dur : tout vient de l'environnement."""
from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

from .channel_layers import build_channel_layers

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise RuntimeError(f"Variable d'environnement obligatoire manquante: {name}")
    return value or ""


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in env(name, default).split(",") if v.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", required=True)
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
_render_host = env("RENDER_EXTERNAL_HOSTNAME")  # variable fournie automatiquement par Render
if _render_host:
    ALLOWED_HOSTS.append(_render_host)

DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "channels",
]
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.profiles",
    "apps.friends",
    "apps.community",
    "apps.messaging",
    "apps.social",
    "apps.notifications",
    "apps.audit",
    "apps.moderation",
    "apps.integrations",
    "apps.analytics",
    "apps.dbobjects",  # DOIT rester en dernier : triggers/vues/fonctions SQL
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "apps.core.middleware.CorrelationIdMiddleware",
    "apps.core.middleware.EdgeSecretMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # statiques (admin) servis par le conteneur lui-meme
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# --------------------------------------------------------------------- PostgreSQL
# Supabase n'est utilise que comme Postgres manage : une simple DATABASE_URL.
# Aucune API/extension proprietaire Supabase n'est requise (portabilite RDS/Cloud SQL).
DATABASES = {
    "default": dj_database_url.parse(
        env("DATABASE_URL", required=True),
        conn_max_age=int(env("DB_CONN_MAX_AGE", "60")),
        conn_health_checks=True,
        ssl_require=env_bool("DB_SSL_REQUIRE", False),
    )
}
DATABASES["default"]["ATOMIC_REQUESTS"] = False  # transactions explicites dans les services
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------- MongoDB / Redis
MONGODB_URL = env("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DATABASE = env("MONGODB_DATABASE", "baobab")
REDIS_URL = env("REDIS_URL", "redis://localhost:6379/0")
CHANNEL_REDIS_URL = env("CHANNEL_REDIS_URL", "redis://localhost:6379/1")  # vide => channel layer en memoire (une seule instance)
REDIS_KEY_PREFIX = "baobab"
FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", "")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": REDIS_KEY_PREFIX,
        "TIMEOUT": 300,
    }
}
CHANNEL_LAYERS = build_channel_layers(CHANNEL_REDIS_URL, REDIS_KEY_PREFIX)

# --------------------------------------------------------------------- Auth / securite
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagePagination",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "600/min"},
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(env("JWT_ACCESS_LIFETIME_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(env("JWT_REFRESH_LIFETIME_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": SECRET_KEY,
}
SPECTACULAR_SETTINGS = {
    "TITLE": "LE BAOBAB API",
    "DESCRIPTION": "African Developer Platform - Connect, Learn, Build, Grow",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# --------------------------------------------------------------------- i18n
LANGUAGE_CODE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Jobs planifies : le Worker Cloudflare (cron trigger) appelle /internal/jobs/<nom>/ signe en HMAC.
INTERNAL_JOB_SECRET = env("INTERNAL_JOB_SECRET", "")
# Secret partage avec le Worker routeur : refuse tout acces direct a l'origine (vide = desactive).
EDGE_SHARED_SECRET = env("EDGE_SHARED_SECRET", "")
# Planificateur interne (thread) : a activer sur le SEUL service web ; voir apps/core/scheduler.py.
ENABLE_IN_PROCESS_SCHEDULER = env_bool("ENABLE_IN_PROCESS_SCHEDULER", False)

# --------------------------------------------------------------------- Logging structure
LOG_LEVEL = env("LOG_LEVEL", "INFO")
LOG_JSON = env_bool("LOG_JSON", False)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"correlation": {"()": "apps.core.logging.CorrelationFilter"}},
    "formatters": {
        "json": {"()": "apps.core.logging.JsonFormatter"},
        "plain": {"format": "%(asctime)s %(levelname)s [%(correlation_id)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "filters": ["correlation"],
            "formatter": "json" if LOG_JSON else "plain",
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {"baobab.slow": {"level": "WARNING"}},
}
