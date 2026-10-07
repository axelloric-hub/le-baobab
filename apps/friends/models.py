"""Graphe social. 5 relations DISTINCTES (ne jamais les fusionner) :
 - Friendship : symetrique, avec demande/acceptation  -> UNE ligne par paire (user_low < user_high)
 - Follow     : asymetrique, sans consentement
 - CloseFriend: liste personnelle, unidirectionnelle (audience 'amis proches')
 - Block      : unidirectionnel, prioritaire sur tout (le blocage est applique partout)
 - Mute/Restriction : masquage unilateral sans notifier l'autre
Le modele a UNE ligne par paire d'amis evite la double ecriture (A,B)+(B,A) et les incoherences ;
la recherche bidirectionnelle devient `user_low=X OR user_high=X`, servie par DEUX index (BitmapOr)."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


class Friendship(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptee"
        DECLINED = "declined", "Refusee"
        CANCELLED = "cancelled", "Annulee"

    user_low = models.ForeignKey(U, on_delete=models.CASCADE, related_name="friendships_low")
    user_high = models.ForeignKey(U, on_delete=models.CASCADE, related_name="friendships_high")
    requested_by = models.ForeignKey(U, on_delete=models.CASCADE, related_name="friend_requests_sent")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "friends_friendship"
        constraints = [
            models.CheckConstraint(condition=models.Q(user_low__lt=models.F("user_high")), name="chk_friendship_ordered"),
            models.CheckConstraint(
                condition=models.Q(requested_by=models.F("user_low")) | models.Q(requested_by=models.F("user_high")),
                name="chk_friendship_requester_in_pair",
            ),
            models.UniqueConstraint(fields=["user_low", "user_high"], name="uniq_friendship_pair"),
        ]
        indexes = [
            # Liste d'amis (hot path) : partiels sur 'accepted', un par cote de la paire.
            models.Index(fields=["user_low", "user_high"], name="friend_low_acc_idx", condition=models.Q(status="accepted")),
            models.Index(fields=["user_high", "user_low"], name="friend_high_acc_idx", condition=models.Q(status="accepted")),
            # Boite de reception des demandes.
            models.Index(fields=["user_low", "-created_at"], name="friend_low_pend_idx", condition=models.Q(status="pending")),
            models.Index(fields=["user_high", "-created_at"], name="friend_high_pend_idx", condition=models.Q(status="pending")),
        ]

    @staticmethod
    def ordered_pair(a, b):
        return (a, b) if str(a) < str(b) else (b, a)


class Follow(UUIDModel):
    follower = models.ForeignKey(U, on_delete=models.CASCADE, related_name="following_set")
    followee = models.ForeignKey(U, on_delete=models.CASCADE, related_name="followers_set")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "friends_follow"
        constraints = [
            models.UniqueConstraint(fields=["follower", "followee"], name="uniq_follow"),
            models.CheckConstraint(condition=~models.Q(follower=models.F("followee")), name="chk_follow_not_self"),
        ]
        # unique couvre (follower -> liste des suivis) ; cet index couvre (followee -> abonnes, fan-out du feed).
        indexes = [models.Index(fields=["followee", "-created_at"], name="follow_followee_idx")]


class CloseFriend(UUIDModel):
    owner = models.ForeignKey(U, on_delete=models.CASCADE, related_name="close_friends")
    friend = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "friends_close_friend"
        constraints = [
            models.UniqueConstraint(fields=["owner", "friend"], name="uniq_closefriend"),
            models.CheckConstraint(condition=~models.Q(owner=models.F("friend")), name="chk_closefriend_not_self"),
        ]
        indexes = [models.Index(fields=["friend"], name="closefriend_friend_idx")]  # "suis-je ami proche de X ?"


class Block(UUIDModel):
    blocker = models.ForeignKey(U, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(U, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "friends_block"
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="uniq_block"),
            models.CheckConstraint(condition=~models.Q(blocker=models.F("blocked")), name="chk_block_not_self"),
        ]
        indexes = [models.Index(fields=["blocked"], name="block_blocked_idx")]  # "qui m'a bloque ?" (filtre du feed)


class Mute(UUIDModel):
    class Scope(models.TextChoices):
        POSTS = "posts", "Publications"
        STATUS = "status", "Statuts"
        NOTIFICATIONS = "notifications", "Notifications"
        ALL = "all", "Tout"

    muter = models.ForeignKey(U, on_delete=models.CASCADE, related_name="mutes_made")
    muted = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    scope = models.CharField(max_length=14, choices=Scope.choices, default=Scope.ALL)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "friends_mute"
        constraints = [
            models.UniqueConstraint(fields=["muter", "muted", "scope"], name="uniq_mute"),
            models.CheckConstraint(condition=~models.Q(muter=models.F("muted")), name="chk_mute_not_self"),
        ]


class Restriction(UUIDModel):
    """'Restreindre' : l'autre peut commenter/ecrire mais ses interactions sont masquees (moderation douce)."""

    restrictor = models.ForeignKey(U, on_delete=models.CASCADE, related_name="restrictions_made")
    restricted = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "friends_restriction"
        constraints = [
            models.UniqueConstraint(fields=["restrictor", "restricted"], name="uniq_restriction"),
            models.CheckConstraint(condition=~models.Q(restrictor=models.F("restricted")), name="chk_restriction_not_self"),
        ]
