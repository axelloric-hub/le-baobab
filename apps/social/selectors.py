"""Lecture : visibilite (confidentialite) appliquee EN SQL via Exists -> jamais de fuite par oubli de filtre Python."""
from __future__ import annotations

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone

from apps.community.models import GroupMember
from apps.core.choices import Visibility
from apps.friends.models import Block, CloseFriend, Follow, Friendship
from apps.social.models import Post, PostAudience, Status, StatusAudience


def _friend_exists(viewer_id, author_ref: str) -> Exists:
    return Exists(
        Friendship.objects.filter(status=Friendship.Status.ACCEPTED).filter(
            Q(user_low_id=viewer_id, user_high_id=OuterRef(author_ref)) | Q(user_high_id=viewer_id, user_low_id=OuterRef(author_ref))
        )
    )


def _blocked_exists(viewer_id, author_ref: str) -> Exists:
    return Exists(
        Block.objects.filter(
            Q(blocker_id=viewer_id, blocked_id=OuterRef(author_ref)) | Q(blocked_id=viewer_id, blocker_id=OuterRef(author_ref))
        )
    )


def visible_posts(viewer_id) -> QuerySet[Post]:
    """Posts publies, non supprimes, que `viewer_id` peut voir (visibilite + blocages). Anonyme => public seulement."""
    base = Post.objects.filter(status=Post.Status.PUBLISHED, deleted_at__isnull=True)
    if viewer_id is None:
        return base.filter(visibility=Visibility.PUBLIC)
    return (
        base.annotate(
            _is_friend=_friend_exists(viewer_id, "author_id"),
            _is_follower=Exists(Follow.objects.filter(follower_id=viewer_id, followee_id=OuterRef("author_id"))),
            _is_close=Exists(CloseFriend.objects.filter(owner_id=OuterRef("author_id"), friend_id=viewer_id)),
            _in_group=Exists(GroupMember.objects.filter(user_id=viewer_id, group_id=OuterRef("group_id"))),
            _in_audience=Exists(PostAudience.objects.filter(post_id=OuterRef("pk"), user_id=viewer_id)),
            _blocked=_blocked_exists(viewer_id, "author_id"),
        )
        .filter(_blocked=False)
        .filter(
            Q(visibility=Visibility.PUBLIC)
            | Q(author_id=viewer_id)
            | Q(visibility=Visibility.FRIENDS, _is_friend=True)
            | Q(visibility=Visibility.FOLLOWERS, _is_follower=True)
            | Q(visibility=Visibility.CLOSE_FRIENDS, _is_close=True)
            | Q(visibility=Visibility.GROUP_MEMBERS, _in_group=True)
            | Q(visibility=Visibility.CUSTOM, _in_audience=True)
        )
    )


def can_view_post(viewer_id, post_id) -> bool:
    return visible_posts(viewer_id).filter(pk=post_id).exists()


def active_statuses_for(viewer_id) -> QuerySet[Status]:
    """Statuts non expires, non supprimes, visibles par le viewer."""
    now = timezone.now()
    base = Status.objects.filter(expires_at__gt=now, deleted_at__isnull=True, archived_at__isnull=True)
    return (
        base.annotate(
            _is_friend=_friend_exists(viewer_id, "author_id"),
            _is_follower=Exists(Follow.objects.filter(follower_id=viewer_id, followee_id=OuterRef("author_id"))),
            _is_close=Exists(CloseFriend.objects.filter(owner_id=OuterRef("author_id"), friend_id=viewer_id)),
            _in_audience=Exists(StatusAudience.objects.filter(status_id=OuterRef("pk"), user_id=viewer_id)),
            _blocked=_blocked_exists(viewer_id, "author_id"),
        )
        .filter(_blocked=False)
        .filter(
            Q(visibility=Visibility.PUBLIC)
            | Q(author_id=viewer_id)
            | Q(visibility=Visibility.FRIENDS, _is_friend=True)
            | Q(visibility=Visibility.FOLLOWERS, _is_follower=True)
            | Q(visibility=Visibility.CLOSE_FRIENDS, _is_close=True)
            | Q(visibility=Visibility.CUSTOM, _in_audience=True)
        )
        .select_related("author__profile")
        .order_by("author_id", "created_at")
    )
