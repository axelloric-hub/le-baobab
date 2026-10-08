"""Confidentialite du portfolio : memes regles que le reste de la plateforme (regle unique : friends.selectors.visibility_allows)."""
from __future__ import annotations

from apps.friends.selectors import visibility_allows
from apps.portfolio.models import Portfolio


def can_view_portfolio(viewer, owner_id) -> bool:
    portfolio = Portfolio.objects.filter(pk=owner_id).first()
    return portfolio is not None and visibility_allows(getattr(viewer, "pk", None), owner_id, portfolio.visibility)
