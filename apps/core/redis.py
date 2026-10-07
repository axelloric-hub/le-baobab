"""Acces Redis centralise : client, scripts Lua (charges depuis database/redis/scripts), primitives
(locks, rate limit, compteurs plafonnes, presence). Redis n'est JAMAIS la verite d'une donnee critique."""
from __future__ import annotations

import json
import time
import uuid
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Iterator

import redis as redis_lib
from django.conf import settings

from apps.core import redis_keys as K
from apps.core.exceptions import ConflictError

SCRIPT_DIR = Path(settings.BASE_DIR) / "database" / "redis" / "scripts"


@lru_cache(maxsize=4)
def _client(url: str) -> redis_lib.Redis:
    return redis_lib.Redis.from_url(
        url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2, health_check_interval=30
    )


def get_redis() -> redis_lib.Redis:
    return _client(settings.REDIS_URL)


def _script(name: str):
    return get_redis().register_script((SCRIPT_DIR / f"{name}.lua").read_text())


# ------------------------------------------------------------------ rate limiting
def rate_limit(scope: str, ident, limit: int, window_s: int) -> tuple[bool, int, int]:
    """Fenetre glissante. Retourne (autorise, restant, retry_after_ms)."""
    now_ms = int(time.time() * 1000)
    allowed, remaining, retry = _script("rate_limit")(
        keys=[K.rate_limit(scope, ident)], args=[now_ms, window_s * 1000, limit, f"{now_ms}-{uuid.uuid4().hex[:8]}"]
    )
    return bool(allowed), int(remaining), int(retry)


# ------------------------------------------------------------------ verrous distribues
@contextmanager
def distributed_lock(resource: str, ident, ttl_s: int = K.TTL_LOCK_DEFAULT, wait_s: float = 0) -> Iterator[str]:
    """Verrou SET NX PX + liberation compare-and-delete. Leve ConflictError si non obtenu.
    Un verrou n'est qu'une optimisation anti-concurrence : l'invariant reste garanti par
    une contrainte UNIQUE / select_for_update en base."""
    r, key, token = get_redis(), K.lock(resource, ident), uuid.uuid4().hex
    deadline = time.monotonic() + wait_s
    while not r.set(key, token, nx=True, px=ttl_s * 1000):
        if time.monotonic() >= deadline:
            raise ConflictError("Ressource occupee, reessayez.", code="locked")
        time.sleep(0.05)
    try:
        yield token
    finally:
        _script("lock_release")(keys=[key], args=[token])


# ------------------------------------------------------------------ compteurs
def capped_incr(key: str, cap: int, ttl_s: int) -> tuple[bool, int]:
    ok, value = _script("capped_incr")(keys=[key], args=[cap, ttl_s])
    return bool(ok), int(value)


def incr_counter(kind: str, ident, by: int = 1) -> int:
    return int(get_redis().incrby(K.counter(kind, ident), by))


def drain_counter(kind: str, ident) -> int:
    """Lit-et-remet-a-zero atomiquement (GETDEL) pour flush vers PostgreSQL."""
    value = get_redis().getdel(K.counter(kind, ident))
    return int(value) if value else 0


# ------------------------------------------------------------------ idempotence (verrou court)
def idempotency_acquire(scope: str, key: str, request_hash: str) -> tuple[str, dict | None]:
    res = _script("idempotency_acquire")(keys=[K.idempotency(scope, key)], args=[request_hash, K.TTL_IDEMPOTENCY])
    state = res[0]
    return state, (json.loads(res[1]) if state == "done" and len(res) > 1 else None)


def idempotency_complete(scope: str, key: str, request_hash: str, response: dict) -> None:
    get_redis().set(K.idempotency(scope, key), f"D:{request_hash}:{json.dumps(response)}", ex=K.TTL_IDEMPOTENCY)


def idempotency_release(scope: str, key: str) -> None:
    get_redis().delete(K.idempotency(scope, key))


# ------------------------------------------------------------------ presence / typing
def heartbeat(user_id) -> None:
    get_redis().set(K.user_presence(user_id), int(time.time()), ex=K.TTL_PRESENCE)


def is_online(user_id) -> bool:
    return bool(get_redis().exists(K.user_presence(user_id)))


def set_typing(conversation_id, user_id) -> None:
    key = K.conversation_typing(conversation_id)
    pipe = get_redis().pipeline()
    pipe.zadd(key, {str(user_id): time.time() + K.TTL_TYPING})
    pipe.expire(key, K.TTL_TYPING * 2)
    pipe.execute()


def who_is_typing(conversation_id) -> list[str]:
    key = K.conversation_typing(conversation_id)
    r = get_redis()
    r.zremrangebyscore(key, 0, time.time())
    return r.zrange(key, 0, -1)
