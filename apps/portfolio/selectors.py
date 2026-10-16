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


def visible_portfolios_q(viewer, prefix: str = "portfolio__"):
    """Meme regle que `visibility_allows`, exprimee en filtre SQL (vitrine Showcase : une requete pour toute la liste)."""
    from django.db.models import Q

    from apps.core.choices import Visibility as V
    from apps.friends.models import Follow
    from apps.friends.selectors import friend_ids, users_hidden_from

    vis, owner = f"{prefix}visibility", f"{prefix}user_id"
    viewer_id = getattr(viewer, "pk", None)
    q = Q(**{vis: V.PUBLIC})
    if viewer_id is None:
        return q & Q(**{f"{prefix}user__status": "active"})
    q |= Q(**{owner: viewer_id})
    q |= Q(**{vis: V.FOLLOWERS, f"{owner}__in": Follow.objects.filter(follower_id=viewer_id).values_list("followee_id", flat=True)})
    q |= Q(**{f"{vis}__in": [V.FRIENDS, V.CLOSE_FRIENDS], f"{owner}__in": friend_ids(viewer_id)})
    return (q & Q(**{f"{prefix}user__status": "active"})) & ~Q(**{f"{owner}__in": users_hidden_from(viewer_id)})
