"""Choix du channel layer Django Channels.
- CHANNEL_REDIS_URL renseignee  -> Redis (plusieurs processus/instances).
- CHANNEL_REDIS_URL vide        -> memoire du processus : valable UNIQUEMENT avec une seule instance et un seul worker
  (offre gratuite : evite qu'un Redis gratuit a quota soit interroge en permanence par chaque connexion WebSocket)."""
from __future__ import annotations


def build_channel_layers(redis_url: str, prefix: str) -> dict:
    if redis_url:
        return {
            "default": {
                "BACKEND": "channels_redis.core.RedisChannelLayer",
                "CONFIG": {"hosts": [redis_url], "prefix": f"{prefix}:asgi", "capacity": 1000, "expiry": 10},
            }
        }
    return {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
