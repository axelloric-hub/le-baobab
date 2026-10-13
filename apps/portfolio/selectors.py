"""Confidentialite du portfolio : memes regles que le reste de la plateforme (regle unique : friends.selectors.visibility_allows)."""
from __future__ import annotations

from apps.friends.selectors import visibility_allows
from apps.portfolio.models import Portfolio


def can_view_portfolio(viewer, owner_id) -> bool:
    """Un membre qui n'a encore rien ajoute n'a pas de ligne Portfolio : on applique la visibilite par defaut
    (portfolio vide) au lieu d'un 404 qui le ferait passer pour prive."""
    portfolio = Portfolio.objects.filter(pk=owner_id).first()
    visibility = portfolio.visibility if portfolio else Portfolio._meta.get_field("visibility").get_default()
    return visibility_allows(getattr(viewer, "pk", None), owner_id, visibility)
