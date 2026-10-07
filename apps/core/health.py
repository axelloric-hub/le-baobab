from __future__ import annotations

import time
from typing import Callable

from django.db import connection

from apps.core.mongo import get_db
from apps.core.redis import get_redis


def _timed(fn: Callable[[], None]) -> dict:
    started = time.perf_counter()
    try:
        fn()
        return {"ok": True, "ms": round((time.perf_counter() - started) * 1000, 2)}
    except Exception as exc:  # noqa: BLE001 - on reporte, on ne propage pas
        return {"ok": False, "error": exc.__class__.__name__}


def check_all() -> dict[str, dict]:
    def pg() -> None:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")

    return {
        "postgres": _timed(pg),
        "mongodb": _timed(lambda: get_db().command("ping")),
        "redis": _timed(lambda: get_redis().ping()),
    }
