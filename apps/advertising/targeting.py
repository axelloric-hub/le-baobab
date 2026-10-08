"""Evaluation du ciblage : fonctions PURES (aucune base) donc testables exhaustivement.
Seuls les criteres de la liste blanche existent ; un critere inconnu ne correspond JAMAIS (echec ferme, jamais ouvert)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from apps.advertising.models import TARGETING_FIELDS


@dataclass(frozen=True)
class UserContext:
    """Ce que la plateforme est autorisee a utiliser pour cibler : competences, interets, metier, localisation generale, langue, niveau."""

    user_id: str | None = None
    personalized: bool = True
    values: dict[str, frozenset] = field(default_factory=dict)  # critere -> ensemble de valeurs (slugs / codes)

    def get(self, name: str) -> frozenset:
        return self.values.get(name, frozenset())


@dataclass(frozen=True)
class Rule:
    field: str
    operator: str  # in | all | not_in
    values: tuple
    required: bool = True
    weight: int = 1


def rule_matches(rule: Rule, ctx: UserContext) -> bool:
    if rule.field not in TARGETING_FIELDS or not rule.values:
        return False  # critere inconnu ou vide : ne cible personne
    have = ctx.get(rule.field)
    wanted = {str(v).lower() for v in rule.values}
    have = {str(v).lower() for v in have}
    if rule.operator == "in":
        return bool(have & wanted)       # OU
    if rule.operator == "all":
        return wanted <= have            # ET
    if rule.operator == "not_in":
        return not (have & wanted)       # NON
    return False


def evaluate(rules: Iterable[Rule], ctx: UserContext) -> tuple[bool, int]:
    """(eligible, bonus). ET entre les regles obligatoires ; les regles souples n'excluent personne mais ajoutent leur poids."""
    rules = list(rules)
    if rules and not ctx.personalized:
        return False, 0  # l'utilisateur a refuse la publicite personnalisee : seules les annonces SANS ciblage personnel lui sont montrees
    bonus = 0
    for r in rules:
        ok = rule_matches(r, ctx)
        if r.required and not ok:
            return False, 0
        if ok and not r.required:
            bonus += r.weight
    return True, bonus
