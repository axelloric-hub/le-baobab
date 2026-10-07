"""Ecritures du graphe social. Toutes atomiques ; les doublons/courses sont arbitres par les contraintes UNIQUE."""
from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.friends.models import Block, CloseFriend, Follow, Friendship, Mute, Restriction
from apps.friends.selectors import are_friends, is_blocked_either_way


@transaction.atomic
def send_friend_request(requester, target) -> Friendship:
    if requester.pk == target.pk:
        raise DomainError("Impossible de s'ajouter soi-meme.", code="self_relation")
    if is_blocked_either_way(requester.pk, target.pk):
        raise PermissionDeniedError("Action impossible.", code="blocked")  # message volontairement neutre
    low, high = Friendship.ordered_pair(requester.pk, target.pk)
    f = Friendship.objects.select_for_update().filter(user_low_id=low, user_high_id=high).first()
    created = False
    if f is None:
        try:
            with transaction.atomic():
                f = Friendship.objects.create(user_low_id=low, user_high_id=high, requested_by=requester)
            created = True
        except IntegrityError:  # requete simultanee : l'autre a gagne
            f = Friendship.objects.select_for_update().get(user_low_id=low, user_high_id=high)
    if not created:
        if f.status == Friendship.Status.ACCEPTED:
            raise ConflictError("Deja amis.", code="already_friends")
        if f.status == Friendship.Status.PENDING:
            if f.requested_by_id == requester.pk:
                raise ConflictError("Demande deja envoyee.", code="already_requested")
            return _accept(f)  # l'autre avait deja demande : demande croisee => acceptation
        # DECLINED / CANCELLED : nouvelle tentative
        f.status, f.requested_by, f.responded_at, f.updated_at = Friendship.Status.PENDING, requester, None, timezone.now()
        f.save()
    publish_event("FriendRequestSent", "friendship", f.pk, {"from": str(requester.pk), "to": str(target.pk)})
    return f


def _accept(f: Friendship) -> Friendship:
    f.status, f.responded_at, f.updated_at = Friendship.Status.ACCEPTED, timezone.now(), timezone.now()
    f.save(update_fields=["status", "responded_at", "updated_at"])
    publish_event("FriendshipCreated", "friendship", f.pk, {"users": [str(f.user_low_id), str(f.user_high_id)]})
    return f


@transaction.atomic
def respond_to_request(friendship_id, responder, accept: bool) -> Friendship:
    f = Friendship.objects.select_for_update().get(pk=friendship_id)
    if responder.pk not in (f.user_low_id, f.user_high_id) or f.requested_by_id == responder.pk:
        raise PermissionDeniedError("Vous ne pouvez pas repondre a cette demande.")
    if f.status != Friendship.Status.PENDING:
        raise ConflictError("Demande deja traitee.", code="not_pending")
    if accept:
        return _accept(f)
    f.status, f.responded_at, f.updated_at = Friendship.Status.DECLINED, timezone.now(), timezone.now()
    f.save(update_fields=["status", "responded_at", "updated_at"])
    return f


@transaction.atomic
def remove_friend(user, other) -> None:
    low, high = Friendship.ordered_pair(user.pk, other.pk)
    Friendship.objects.filter(user_low_id=low, user_high_id=high).delete()
    CloseFriend.objects.filter(owner_id__in=[user.pk, other.pk], friend_id__in=[user.pk, other.pk]).delete()


@transaction.atomic
def follow(follower, followee) -> Follow:
    if follower.pk == followee.pk:
        raise DomainError("Impossible de se suivre soi-meme.", code="self_relation")
    if is_blocked_either_way(follower.pk, followee.pk):
        raise PermissionDeniedError("Action impossible.", code="blocked")
    obj, created = Follow.objects.get_or_create(follower=follower, followee=followee)
    if created:
        publish_event("UserFollowed", "follow", obj.pk, {"follower": str(follower.pk), "followee": str(followee.pk)})
    return obj


def unfollow(follower, followee) -> None:
    Follow.objects.filter(follower=follower, followee=followee).delete()


@transaction.atomic
def block_user(blocker, blocked) -> Block:
    """Le blocage purge amitie, abonnements (dans les deux sens), amis proches, restrictions."""
    if blocker.pk == blocked.pk:
        raise DomainError("Impossible de se bloquer soi-meme.", code="self_relation")
    obj, _ = Block.objects.get_or_create(blocker=blocker, blocked=blocked)
    remove_friend(blocker, blocked)
    Follow.objects.filter(follower_id__in=[blocker.pk, blocked.pk], followee_id__in=[blocker.pk, blocked.pk]).delete()
    Restriction.objects.filter(restrictor=blocker, restricted=blocked).delete()
    publish_event("UserBlocked", "block", obj.pk, {"blocker": str(blocker.pk), "blocked": str(blocked.pk)})
    return obj


def unblock_user(blocker, blocked) -> None:
    Block.objects.filter(blocker=blocker, blocked=blocked).delete()


@transaction.atomic
def add_close_friend(owner, friend) -> CloseFriend:
    if not are_friends(owner.pk, friend.pk):
        raise DomainError("Seuls vos amis peuvent devenir amis proches.", code="not_friends")
    obj, _ = CloseFriend.objects.get_or_create(owner=owner, friend=friend)
    return obj


def mute_user(muter, muted, scope: str = Mute.Scope.ALL, expires_at=None) -> Mute:
    obj, _ = Mute.objects.update_or_create(muter=muter, muted=muted, scope=scope, defaults={"expires_at": expires_at})
    return obj
