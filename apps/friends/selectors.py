"""Lectures du graphe social (requetes optimisees, aucune ecriture)."""
from __future__ import annotations

from django.db.models import Case, F, Q, QuerySet, When

from apps.accounts.models import User
from apps.friends.models import Block, Follow, Friendship


def friendship_between(a, b) -> Friendship | None:
    low, high = Friendship.ordered_pair(a, b)
    return Friendship.objects.filter(user_low_id=low, user_high_id=high).first()


def friend_ids(user_id) -> QuerySet:
    """IDs des amis acceptes, en UNE requete (BitmapOr sur les deux index partiels)."""
    qs = Friendship.objects.filter(status=Friendship.Status.ACCEPTED).filter(Q(user_low_id=user_id) | Q(user_high_id=user_id))
    return qs.annotate(other=Case(When(user_low_id=user_id, then=F("user_high_id")), default=F("user_low_id"))).values_list("other", flat=True)


def are_friends(a, b) -> bool:
    f = friendship_between(a, b)
    return bool(f and f.status == Friendship.Status.ACCEPTED)


def is_blocked_either_way(a, b) -> bool:
    return Block.objects.filter(Q(blocker_id=a, blocked_id=b) | Q(blocker_id=b, blocked_id=a)).exists()


def follower_ids(user_id) -> QuerySet:
    return Follow.objects.filter(followee_id=user_id).values_list("follower_id", flat=True)


def pending_requests_for(user_id) -> QuerySet:
    return (
        Friendship.objects.filter(status=Friendship.Status.PENDING)
        .filter(Q(user_low_id=user_id) | Q(user_high_id=user_id))
        .exclude(requested_by_id=user_id)
        .select_related("requested_by__profile")
        .order_by("-created_at")
    )


def users_hidden_from(user_id) -> QuerySet:
    """Utilisateurs a exclure de TOUT contenu montre a `user_id` (blocages dans les deux sens)."""
    blocked = Block.objects.filter(blocker_id=user_id).values_list("blocked_id", flat=True)
    blockers = Block.objects.filter(blocked_id=user_id).values_list("blocker_id", flat=True)
    return User.objects.filter(Q(pk__in=blocked) | Q(pk__in=blockers)).values_list("pk", flat=True)
