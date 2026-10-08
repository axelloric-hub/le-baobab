"""Arithmetique monetaire en ENTIERS (plus petite unite). Jamais de flottants."""
from __future__ import annotations


def allocate(total: int, weights: list[int]) -> list[int]:
    """Repartit `total` proportionnellement aux poids (methode du plus grand reste) : la somme des parts == total, au centime pres."""
    if total < 0 or any(w < 0 for w in weights):
        raise ValueError("montants negatifs interdits")
    s = sum(weights)
    if s == 0 or total == 0:
        return [0] * len(weights)
    shares = [total * w // s for w in weights]
    remainder = total - sum(shares)
    order = sorted(range(len(weights)), key=lambda i: (-((total * weights[i]) % s), i))
    for i in order[:remainder]:
        shares[i] += 1
    return shares


def platform_fee(amount: int, bps: int) -> int:
    """Commission en points de base (1000 = 10 %), arrondie vers le bas : l'arrondi profite au vendeur."""
    return amount * bps // 10_000


def percent_of(amount: int, percent: int) -> int:
    return amount * percent // 100
