"""Communaute > Groupes > Channels.
 Community : regroupe plusieurs Group (ex: 'Dev Cameroun' > Django, React, DevOps).
 Group     : unite d'appartenance + permissions (roles par groupe).
 Channel   : espace de discussion/annonce, rattache a un groupe OU a une communaute.
Un utilisateur peut appartenir a N groupes et N channels. 'Membership' != 'friendship' != 'follow'."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class Community(UUIDModel):
    class Privacy(models.TextChoices):
        PUBLIC = "public", "Publique"
        PRIVATE = "private", "Privee"

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(max_length=3000, blank=True)
    privacy = models.CharField(max_length=10, choices=Privacy.choices, default=Privacy.PUBLIC)
    owner = models.ForeignKey(U, on_delete=models.PROTECT, related_name="owned_communities")
    avatar_key = models.CharField(max_length=300, blank=True)
    cover_key = models.CharField(max_length=300, blank=True)
    country = models.ForeignKey("profiles.Country", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_community"
        verbose_name_plural = "communities"
        indexes = [models.Index(fields=["privacy", "-created_at"], name="community_priv_idx", condition=Q(archived_at__isnull=True))]

    def __str__(self) -> str:
        return self.name


class Group(UUIDModel):
    class Privacy(models.TextChoices):
        PUBLIC = "public", "Public (visible, lisible par tous)"
        PRIVATE = "private", "Prive (visible, contenu reserve aux membres)"
        HIDDEN = "hidden", "Secret (invisible hors membres)"

    class JoinPolicy(models.TextChoices):
        OPEN = "open", "Ouvert"
        APPROVAL = "approval", "Sur approbation"
        INVITE_ONLY = "invite_only", "Sur invitation"

    community = models.ForeignKey(Community, null=True, blank=True, on_delete=models.SET_NULL, related_name="groups")
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(max_length=3000, blank=True)
    privacy = models.CharField(max_length=10, choices=Privacy.choices, default=Privacy.PUBLIC)
    join_policy = models.CharField(max_length=12, choices=JoinPolicy.choices, default=JoinPolicy.OPEN)
    owner = models.ForeignKey(U, on_delete=models.PROTECT, related_name="owned_groups")
    avatar_key = models.CharField(max_length=300, blank=True)
    cover_key = models.CharField(max_length=300, blank=True)
    member_count = models.PositiveIntegerField(default=0)  # maintenu par trigger SQL (voir DATABASE_FUNCTIONS.md)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_group"
        indexes = [
            models.Index(fields=["community", "-member_count"], name="group_community_size_idx"),
            # Decouverte : seulement groupes publics actifs, tries par taille.
            models.Index(fields=["-member_count"], name="group_discover_idx", condition=Q(privacy="public", archived_at__isnull=True)),
        ]

    def __str__(self) -> str:
        return self.name


class GroupPermission(models.Model):
    """Catalogue ferme de permissions (ex: post.create, post.delete_any, member.ban, member.invite, group.edit)."""

    code = models.CharField(max_length=60, primary_key=True)
    description = models.CharField(max_length=200)

    class Meta:
        db_table = "community_group_permission"

    def __str__(self) -> str:
        return self.code


class GroupRole(UUIDModel):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=50)
    position = models.PositiveSmallIntegerField(default=0)  # hierarchie : on ne gere que les roles de position inferieure
    is_default = models.BooleanField(default=False)  # role attribue a l'adhesion
    is_owner_role = models.BooleanField(default=False)
    permissions = models.ManyToManyField(GroupPermission, blank=True, related_name="roles", db_table="community_group_role_permission")

    class Meta:
        db_table = "community_group_role"
        constraints = [
            models.UniqueConstraint(fields=["group", "name"], name="uniq_grouprole_name"),
            # Exactement UN role par defaut par groupe : garanti par la base.
            models.UniqueConstraint(fields=["group"], condition=Q(is_default=True), name="uniq_grouprole_default"),
            models.UniqueConstraint(fields=["group"], condition=Q(is_owner_role=True), name="uniq_grouprole_owner"),
        ]


class GroupMember(UUIDModel):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="group_memberships")
    role = models.ForeignKey(GroupRole, on_delete=models.PROTECT, related_name="members")
    invited_by = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    joined_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_group_member"
        constraints = [models.UniqueConstraint(fields=["group", "user"], name="uniq_group_member")]
        # unique(group,user) sert "membres du groupe" ; celui-ci sert "mes groupes" (hot path du feed).
        indexes = [models.Index(fields=["user", "-joined_at"], name="groupmember_user_idx")]


class GroupInvitation(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptee"
        DECLINED = "declined", "Refusee"
        REVOKED = "revoked", "Revoquee"
        EXPIRED = "expired", "Expiree"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="invitations")
    invited_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="group_invitations")
    invited_by = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "community_group_invitation"
        constraints = [models.UniqueConstraint(fields=["group", "invited_user"], condition=Q(status="pending"), name="uniq_group_invite_pending")]
        indexes = [models.Index(fields=["invited_user", "-created_at"], name="groupinvite_user_idx", condition=Q(status="pending"))]


class GroupJoinRequest(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        APPROVED = "approved", "Approuvee"
        REJECTED = "rejected", "Rejetee"
        CANCELLED = "cancelled", "Annulee"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="join_requests")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="group_join_requests")
    message = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_group_join_request"
        constraints = [models.UniqueConstraint(fields=["group", "user"], condition=Q(status="pending"), name="uniq_group_joinreq_pending")]
        indexes = [models.Index(fields=["group", "-created_at"], name="groupjoinreq_group_idx", condition=Q(status="pending"))]


class GroupBan(UUIDModel):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="bans")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="group_bans")
    banned_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    reason = models.CharField(max_length=500, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)  # NULL = definitif
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_group_ban"
        constraints = [models.UniqueConstraint(fields=["group", "user"], name="uniq_group_ban")]


class GroupMute(UUIDModel):
    """Sourdine de MODERATION : le membre reste dans le groupe mais ne peut plus publier jusqu'a expiration."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="mutes")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="group_mutes")
    muted_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    reason = models.CharField(max_length=500, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_group_mute"
        constraints = [models.UniqueConstraint(fields=["group", "user"], name="uniq_group_mute")]


class Channel(UUIDModel):
    class Type(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Prive"
        RESTRICTED = "restricted", "Restreint (lecture seule sauf roles)"
        ANNOUNCEMENT = "announcement", "Annonces"
        DISCUSSION = "discussion", "Discussion"
        SUPPORT = "support", "Support"
        CLASSROOM = "classroom", "Lie a une classroom"

    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE, related_name="channels")
    community = models.ForeignKey(Community, null=True, blank=True, on_delete=models.CASCADE, related_name="channels")
    # Reference INTER-DOMAINE par identifiant (pas de FK) : education/ pourra etre extrait en service.
    classroom_ref = models.UUIDField(null=True, blank=True)
    slug = models.SlugField(max_length=80)
    name = models.CharField(max_length=100)
    topic = models.CharField(max_length=300, blank=True)
    type = models.CharField(max_length=14, choices=Type.choices, default=Type.DISCUSSION)
    created_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_channel"
        constraints = [
            models.CheckConstraint(
                condition=Q(group__isnull=False, community__isnull=True) | Q(group__isnull=True, community__isnull=False)
                | Q(group__isnull=True, community__isnull=True, classroom_ref__isnull=False),
                name="chk_channel_single_parent",
            ),
            models.UniqueConstraint(fields=["group", "slug"], condition=Q(group__isnull=False), name="uniq_channel_group_slug"),
            models.UniqueConstraint(fields=["community", "slug"], condition=Q(community__isnull=False), name="uniq_channel_comm_slug"),
        ]
        indexes = [models.Index(fields=["classroom_ref"], name="channel_classroom_idx", condition=Q(classroom_ref__isnull=False))]


class ChannelMember(UUIDModel):
    class Role(models.TextChoices):
        MEMBER = "member", "Membre"
        MODERATOR = "moderator", "Moderateur"

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="channel_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    notifications_muted = models.BooleanField(default=False)
    joined_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "community_channel_member"
        constraints = [models.UniqueConstraint(fields=["channel", "user"], name="uniq_channel_member")]
        indexes = [models.Index(fields=["user"], name="channelmember_user_idx")]
