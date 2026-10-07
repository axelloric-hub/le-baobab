"""Tests : vrai PostgreSQL + vrai Redis (db 15), MongoDB simule via mongomock."""
import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-test-secret-key-test-secret-key-1234")
os.environ.setdefault("DATABASE_URL", "postgresql://baobab:baobab@localhost:5432/baobab")

from .base import *  # noqa: F401,F403

DEBUG = False
MONGODB_URL = "mongomock://localhost"
MONGODB_DATABASE = "baobab_test"
REDIS_URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
