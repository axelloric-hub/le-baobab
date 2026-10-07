from __future__ import annotations

import json

from django.utils import timezone

from apps.community.models import Group, GroupBan, GroupMember, GroupMute
from apps.core import redis as R
from apps.core import redis_keys as K


def get_membership(user_id, group_id) -> GroupMember | None:
    return GroupMember.objects.select_related("role").filter(user_id=user_id, group_id=group_id).first()


def is_banned(user_id, group_id) -> bool:
    now = timezone.now()
    return any(
        b.expires_at is None or b.expires_at > now for b in GroupBan.objects.filter(user_id=user_id, group_id=group_id)
    )


def is_muted(user_id, group_id) -> bool:
    return GroupMute.objects.filter(user_id=user_id, group_id=group_id, expires_at__gt=timezone.now()).exists()


def permissions_of(user_id, group_id) -> set[str]:
    """Permissions effectives. Cache Redis 2 min (TTL court : l'invalidation explicite fait le reste)."""
    key = K.user_permissions(user_id) + f":g:{group_id}"
    r = R.get_redis()
    cached = r.get(key)
    if cached is not None:
        return set(json.loads(cached))
    m = get_membership(user_id, group_id)
    perms = set(m.role.permissions.values_list("code", flat=True)) if m else set()
    if m and is_muted(user_id, group_id):
        perms -= {"post.create", "comment.create"}
    r.set(key, json.dumps(sorted(perms)), ex=K.TTL_PERMISSIONS_CACHE)
    return perms


def invalidate_permissions(user_id, group_id) -> None:
    R.get_redis().delete(K.user_permissions(user_id) + f":g:{group_id}")


def can(user_id, group_id, permission: str) -> bool:
    return permission in permissions_of(user_id, group_id)


def can_view_group_content(user_id, group: Group) -> bool:
    if group.privacy == Group.Privacy.PUBLIC:
        return not (user_id and is_banned(user_id, group.pk))
    return bool(user_id) and get_membership(user_id, group.pk) is not None
