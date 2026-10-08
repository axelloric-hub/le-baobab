"""Registres d'extension entre domaines (evite les imports directs). Un domaine DECLARE ce qu'il sait faire ; l'autre l'utilise."""
from __future__ import annotations

from typing import Callable

# (scope, target_id, acteur) -> True si la cible existe ET que l'acteur peut la vendre. Enregistre par le domaine education.
_ENTITLEMENT_TARGET_VALIDATORS: list[Callable] = []


def register_entitlement_target_validator(fn: Callable) -> None:
    if fn not in _ENTITLEMENT_TARGET_VALIDATORS:
        _ENTITLEMENT_TARGET_VALIDATORS.append(fn)


def entitlement_target_allowed(scope: str, target_id, actor) -> bool:
    return any(fn(scope, target_id, actor) for fn in _ENTITLEMENT_TARGET_VALIDATORS)
