"""Registre des hooks de moderation : chaque domaine declare comment masquer/retirer/restaurer SES objets.
Evite que `moderation` importe `social`, `marketplace`, etc. (monolithe modulaire -> microservices)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional
from uuid import UUID


@dataclass(frozen=True)
class ModerationHooks:
    hide: Callable[[UUID], None]
    remove: Callable[[UUID], None]
    restore: Callable[[UUID], None]
    owner_of: Callable[[UUID], Optional[UUID]]  # id de l'utilisateur proprietaire


_REGISTRY: dict[str, ModerationHooks] = {}


def register(target_type: str, hooks: ModerationHooks) -> None:
    _REGISTRY[target_type] = hooks


def get(target_type: str) -> ModerationHooks | None:
    return _REGISTRY.get(target_type)


def registered_types() -> list[str]:
    return sorted(_REGISTRY)
