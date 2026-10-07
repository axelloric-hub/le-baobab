"""Acces MongoDB centralise (pymongo). Les schemas/validators/index vivent dans database/mongodb/
et sont appliques par `ensure_schema()` (idempotent) : `manage.py mongo_setup`."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import pymongo
from django.conf import settings

MONGO_DIR = Path(settings.BASE_DIR) / "database" / "mongodb"


@lru_cache(maxsize=2)
def _client(url: str) -> Any:
    if url.startswith("mongomock://"):
        import mongomock

        return mongomock.MongoClient()
    return pymongo.MongoClient(url, tz_aware=True, serverSelectionTimeoutMS=3000, appname="le-baobab")


def get_db():
    return _client(settings.MONGODB_URL)[settings.MONGODB_DATABASE]


def collection(name: str):
    return get_db()[name]


def load_collection_specs() -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted((MONGO_DIR / "collections").glob("*.json"))]


def _index_kwargs(spec: dict) -> dict:
    kw = {k: v for k, v in spec.items() if k in {"name", "unique", "sparse", "expireAfterSeconds", "partialFilterExpression"}}
    return kw


def ensure_schema() -> dict[str, int]:
    """Cree collections (+ validateur JSON Schema) et index. Reexecutable : collMod si existante."""
    db = get_db()
    existing = set(db.list_collection_names())
    created = indexes = 0
    for spec in load_collection_specs():
        name = spec["name"]
        validator = {"$jsonSchema": spec["jsonSchema"]} if spec.get("jsonSchema") else None
        if name not in existing:
            kwargs: dict[str, Any] = {}
            if validator and not settings.MONGODB_URL.startswith("mongomock://"):  # mongomock ne supporte pas les validateurs
                kwargs.update(validator=validator, validationLevel="moderate", validationAction="error")
            db.create_collection(name, **kwargs)
            created += 1
        elif validator and not settings.MONGODB_URL.startswith("mongomock://"):
            db.command("collMod", name, validator=validator, validationLevel="moderate", validationAction="error")
        for idx in spec.get("indexes", []):
            keys = [(k, v) for k, v in idx["keys"]]
            db[name].create_index(keys, **_index_kwargs(idx))
            indexes += 1
    return {"collections_created": created, "indexes_ensured": indexes}
