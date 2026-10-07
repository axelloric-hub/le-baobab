"""Utilitaires de test partages (fabriques + isolation Redis/Mongo)."""
from __future__ import annotations

import itertools

from django.test import TestCase, TransactionTestCase

from apps.accounts.services import register_user

_counter = itertools.count(1)


def make_user(username: str | None = None, **kw):
    n = next(_counter)
    username = username or f"user{n}"
    return register_user(email=f"{username}@example.com", username=username, password="S3cure-pass-phrase!", display_name=kw.get("display_name"))


def reset_stores() -> None:
    from apps.core.mongo import get_db
    from apps.core.redis import get_redis

    get_redis().flushdb()
    db = get_db()
    for name in db.list_collection_names():
        db.drop_collection(name)


class StoresMixin:
    def setUp(self):
        super().setUp()
        reset_stores()


class BaobabTestCase(StoresMixin, TestCase):
    pass


class BaobabTransactionTestCase(StoresMixin, TransactionTestCase):
    """Pour les tests de concurrence / on_commit / WebSocket (vraies transactions).
    serialized_rollback : restaure les donnees de reference (migrations) que le flush de fin de test supprimerait."""

    serialized_rollback = True
