from __future__ import annotations

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.community.constants import DEFAULT_PERMISSIONS, DEFAULT_ROLES
from apps.community.models import (
    Group, GroupBan, GroupInvitation, GroupJoinRequest, GroupMember, GroupMute, GroupPermission, GroupRole,
)
from apps.community.selectors import can, get_membership, invalidate_permissions, is_banned
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event


@transaction.atomic
def create_group(*, owner, name: str, slug: str, community=None, privacy=Group.Privacy.PUBLIC,
                 join_policy=Group.JoinPolicy.OPEN, description: str = "") -> Group:
    """Cree le groupe, ses roles par defaut et inscrit le createur comme owner."""
    group = Group.objects.create(owner=owner, name=name, slug=slug, community=community, privacy=privacy,
                                 join_policy=join_policy, description=description)
    for code, desc in DEFAULT_PERMISSIONS.items():
        GroupPermission.objects.get_or_create(code=code, defaults={"description": desc})
    roles = {}
    for role_name, (position, perms, is_default, is_owner) in DEFAULT_ROLES.items():
        role = GroupRole.objects.create(group=group, name=role_name, position=position, is_default=is_default, is_owner_role=is_owner)
        role.permissions.set(perms)
        roles[role_name] = role
    GroupMember.objects.create(group=group, user=owner, role=roles["owner"])
    publish_event("GroupCreated", "group", group.pk, {"owner": str(owner.pk)})
    return group


def _default_role(group: Group) -> GroupRole:
    return GroupRole.objects.get(group=group, is_default=True)


def _add_member(group: Group, user, invited_by=None) -> GroupMember:
    try:
        with transaction.atomic():
            m = GroupMember.objects.create(group=group, user=user, role=_default_role(group), invited_by=invited_by)
    except IntegrityError as exc:
        raise ConflictError("Deja membre.", code="already_member") from exc
    invalidate_permissions(user.pk, group.pk)  # un cache 'non-membre' ne doit pas survivre a l'adhesion
    publish_event("GroupMemberJoined", "group", group.pk, {"user": str(user.pk)})
    return m


@transaction.atomic
def join_group(user, group: Group) -> GroupMember | GroupJoinRequest:
    group = Group.objects.select_for_update().get(pk=group.pk)
    if group.archived_at:
        raise DomainError("Groupe archive.", code="archived")
    if is_banned(user.pk, group.pk):
        raise PermissionDeniedError("Vous ne pouvez pas rejoindre ce groupe.", code="banned")
    if get_membership(user.pk, group.pk):
        raise ConflictError("Deja membre.", code="already_member")
    if group.join_policy == Group.JoinPolicy.OPEN:
        return _add_member(group, user)
    if group.join_policy == Group.JoinPolicy.APPROVAL:
        try:
            with transaction.atomic():
                return GroupJoinRequest.objects.create(group=group, user=user)
        except IntegrityError as exc:
            raise ConflictError("Demande deja en attente.", code="already_requested") from exc
    raise PermissionDeniedError("Ce groupe est sur invitation.", code="invite_only")


@transaction.atomic
def review_join_request(request_id, reviewer, approve: bool) -> GroupJoinRequest:
    req = GroupJoinRequest.objects.select_for_update().select_related("group", "user").get(pk=request_id)
    if not can(reviewer.pk, req.group_id, "member.approve"):
        raise PermissionDeniedError("Permission 'member.approve' requise.")
    if req.status != GroupJoinRequest.Status.PENDING:
        raise ConflictError("Demande deja traitee.", code="not_pending")
    req.status = GroupJoinRequest.Status.APPROVED if approve else GroupJoinRequest.Status.REJECTED
    req.reviewed_by, req.reviewed_at = reviewer, timezone.now()
    req.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    if approve and not is_banned(req.user_id, req.group_id):
        _add_member(req.group, req.user, invited_by=reviewer)
    return req


@transaction.atomic
def invite_user(group: Group, inviter, invited_user, ttl_days: int = 14) -> GroupInvitation:
    if not can(inviter.pk, group.pk, "member.invite"):
        raise PermissionDeniedError("Permission 'member.invite' requise.")
    if get_membership(invited_user.pk, group.pk):
        raise ConflictError("Deja membre.", code="already_member")
    try:
        with transaction.atomic():
            return GroupInvitation.objects.create(group=group, invited_user=invited_user, invited_by=inviter,
                                                  expires_at=timezone.now() + timedelta(days=ttl_days))
    except IntegrityError as exc:
        raise ConflictError("Invitation deja en attente.", code="already_invited") from exc


@transaction.atomic
def respond_to_invitation(invitation_id, user, accept: bool) -> GroupInvitation:
    inv = GroupInvitation.objects.select_for_update().select_related("group").get(pk=invitation_id, invited_user=user)
    if inv.status != GroupInvitation.Status.PENDING:
        raise ConflictError("Invitation deja traitee.", code="not_pending")
    if inv.expires_at and inv.expires_at < timezone.now():
        inv.status = GroupInvitation.Status.EXPIRED
        inv.save(update_fields=["status"])
        raise DomainError("Invitation expiree.", code="expired")
    inv.status = GroupInvitation.Status.ACCEPTED if accept else GroupInvitation.Status.DECLINED
    inv.responded_at = timezone.now()
    inv.save(update_fields=["status", "responded_at"])
    if accept and not is_banned(user.pk, inv.group_id):
        _add_member(inv.group, user, invited_by=inv.invited_by)
    return inv


@transaction.atomic
def leave_group(user, group: Group) -> None:
    m = get_membership(user.pk, group.pk)
    if not m:
        return
    if m.role.is_owner_role:
        raise DomainError("Le proprietaire doit transferer la propriete avant de partir.", code="owner_cannot_leave")
    m.delete()
    invalidate_permissions(user.pk, group.pk)
    publish_event("GroupMemberLeft", "group", group.pk, {"user": str(user.pk)})


@transaction.atomic
def ban_member(group: Group, actor, target, reason: str = "", expires_at=None) -> GroupBan:
    if not can(actor.pk, group.pk, "member.ban"):
        raise PermissionDeniedError("Permission 'member.ban' requise.")
    t_m, a_m = get_membership(target.pk, group.pk), get_membership(actor.pk, group.pk)
    if t_m and a_m and t_m.role.position >= a_m.role.position:
        raise PermissionDeniedError("Vous ne pouvez pas bannir un membre de rang egal ou superieur.")
    ban, _ = GroupBan.objects.update_or_create(group=group, user=target, defaults={"banned_by": actor, "reason": reason, "expires_at": expires_at})
    if t_m:
        t_m.delete()
    invalidate_permissions(target.pk, group.pk)
    publish_event("GroupMemberBanned", "group", group.pk, {"user": str(target.pk), "by": str(actor.pk)})
    return ban


@transaction.atomic
def mute_member(group: Group, actor, target, duration: timedelta, reason: str = "") -> GroupMute:
    if not can(actor.pk, group.pk, "member.mute"):
        raise PermissionDeniedError("Permission 'member.mute' requise.")
    mute, _ = GroupMute.objects.update_or_create(
        group=group, user=target, defaults={"muted_by": actor, "reason": reason, "expires_at": timezone.now() + duration}
    )
    invalidate_permissions(target.pk, group.pk)
    return mute
