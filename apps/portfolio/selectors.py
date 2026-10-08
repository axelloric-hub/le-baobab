"""Confidentialite du portfolio : memes regles que le reste de la plateforme (public / abonnes / amis / prive), blocages prioritaires."""
from __future__ import annotations

from apps.core.choices import Visibility
from apps.friends.models import Follow
from apps.friends.selectors import are_friends, is_blocked_either_way
from apps.portfolio.models import Portfolio


def can_view_portfolio(viewer, owner_id) -> bool:
    portfolio = Portfolio.objects.filter(pk=owner_id).first()
    if portfolio is None:
        return False
    viewer_id = getattr(viewer, "pk", None)
    if viewer_id == owner_id:
        return True
    if viewer_id and is_blocked_either_way(viewer_id, owner_id):
        return False
    v = portfolio.visibility
    if v == Visibility.PUBLIC:
        return True
    if not viewer_id or v == Visibility.PRIVATE:
        return False
    if v == Visibility.FOLLOWERS:
        return Follow.objects.filter(follower_id=viewer_id, followee_id=owner_id).exists()
    if v in (Visibility.FRIENDS, Visibility.CLOSE_FRIENDS):
        return are_friends(viewer_id, owner_id)
    return False
