"""Execution de fichiers SQL versionnes (database/postgres) depuis les migrations.
RunPython + cursor.execute (sans parametres) plutot que RunSQL : evite le decoupage `sqlparse` qui peut corrompre les corps `$$ ... $$`."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.db import migrations

SQL_ROOT = Path(settings.BASE_DIR) / "database" / "postgres"


def read(relative: str) -> str:
    return (SQL_ROOT / relative).read_text(encoding="utf-8")


def run_files(forward: list[str], backward: list[str] | None = None) -> migrations.RunPython:
    def _forward(apps, schema_editor):
        with schema_editor.connection.cursor() as cur:
            for name in forward:
                cur.execute(read(name))

    def _backward(apps, schema_editor):
        with schema_editor.connection.cursor() as cur:
            for name in backward or []:
                cur.execute(read(name))

    return migrations.RunPython(_forward, _backward if backward else migrations.RunPython.noop)
