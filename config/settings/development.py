"""Developpement local uniquement. Valeurs par defaut NON secretes, jamais utilisables en production
(production.py refuse une SECRET_KEY courte)."""
import os

os.environ.setdefault("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me-0123456789abcdef")
os.environ.setdefault("DATABASE_URL", "postgresql://baobab:baobab@localhost:5432/baobab")

from .base import *  # noqa: E402,F401,F403

DEBUG = True
