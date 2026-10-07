"""Messagerie. DECISION : les messages vivent dans PostgreSQL (et non MongoDB).
Raisons : (1) ordre total par conversation via `seq` gapless attribue par trigger, (2) autorisation = jointure
avec l'appartenance, (3) integrite (FK, reponses, threads, suppression), (4) edition/historique transactionnels.
Le volume est gere par : index (conversation, seq), pagination curseur, partitionnement futur par hash(conversation_id).
Redis : presence, typing, compteurs non-lus chauds, channel layer. JAMAIS stockage de messages."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import SoftDeleteModel, UUIDModel

U = settings.AUTH_USER_MODEL


class Conversation(UUIDModel):
    class Type(models.TextChoices):
        DIRECT = "direct", "Message direct"
        GROUP = "group", "Conversation de groupe"
        CHANNEL = "channel", "Conversation de channel"
        SUPPORT = "support", "Support"
        CLASSROOM = "classroom", "Classroom"
        ORGANIZATION = "organization", "Organisation"

    type = models.CharField(max_length=14, choices=Type.choices)
    title = models.CharField(max_length=150, blank=True)
    # Rattachements : FK intra-domaine communautaire, references par id pour les autres domaines.
    group = models.ForeignKey("community.Group", null=True, blank=True, on_delete=models.CASCADE, related_name="conversations")
    channel = models.OneToOneField("community.Channel", null=True, blank=True, on_delete=models.CASCADE, related_name="conversation")
    classroom_ref = models.UUIDField(null=True, blank=True)
    organization_ref = models.UUIDField(null=True, blank=True)
    # Paire canonique 'low:high' => UNE seule conversation directe par paire, garantie par UNIQUE.
    direct_key = models.CharField(max_length=73, null=True, blank=True)
    created_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    message_seq = models.BigIntegerField(default=0, editable=False)  # dernier seq attribue (trigger)
    last_message_id = models.UUIDField(null=True, blank=True, editable=False)
    last_message_at = models.DateTimeField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "messaging_conversation"
        constraints = [
            models.UniqueConstraint(fields=["direct_key"], name="uniq_conversation_direct_key"),
            models.CheckConstraint(
                condition=(Q(type="direct", direct_key__isnull=False)) | (~Q(type="direct") & Q(direct_key__isnull=True)),
                name="chk_conversation_direct_key",
            ),
        ]
        indexes = [
            models.Index(fields=["-last_message_at"], name="conversation_last_msg_idx"),
            models.Index(fields=["group"], name="conversation_group_idx", condition=Q(group__isnull=False)),
            models.Index(fields=["classroom_ref"], name="conversation_classroom_idx", condition=Q(classroom_ref__isnull=False)),
        ]

    @staticmethod
    def make_direct_key(a, b) -> str:
        low, high = sorted([str(a), str(b)])
        return f"{low}:{high}"


class ConversationMember(UUIDModel):
    class Role(models.TextChoices):
        MEMBER = "member", "Membre"
        ADMIN = "admin", "Administrateur"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="conversation_memberships")
    role = models.CharField(max_length=8, choices=Role.choices, default=Role.MEMBER)
    # Recus/lus par POINTEUR de seq : O(membres) au lieu de O(messages x membres) d'une table MessageRead.
    last_delivered_seq = models.BigIntegerField(default=0)
    last_read_seq = models.BigIntegerField(default=0)
    muted_until = models.DateTimeField(null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    joined_at = models.DateTimeField(default=timezone.now, editable=False)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "messaging_conversation_member"
        constraints = [
            models.UniqueConstraint(fields=["conversation", "user"], name="uniq_conversation_member"),
            models.CheckConstraint(condition=Q(last_read_seq__gte=0, last_delivered_seq__gte=0), name="chk_convmember_seq_nonneg"),
        ]
        # Boite de reception : conversations ACTIVES d'un utilisateur.
        indexes = [models.Index(fields=["user", "conversation"], name="convmember_inbox_idx", condition=Q(left_at__isnull=True))]


class Message(UUIDModel, SoftDeleteModel):
    class Kind(models.TextChoices):
        TEXT = "text", "Texte"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        FILE = "file", "Fichier"
        CODE = "code", "Code"
        SYSTEM = "system", "Systeme"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="sent_messages")
    seq = models.BigIntegerField(default=0, editable=False)  # attribue par trigger BEFORE INSERT
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.TEXT)
    body = models.TextField(max_length=10000, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # ex: langage du bloc de code, apercu de lien
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies")
    thread_root = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="thread_messages")
    reply_count = models.PositiveIntegerField(default=0, editable=False)  # sur la racine du thread (trigger)
    last_reply_at = models.DateTimeField(null=True, blank=True, editable=False)
    client_msg_id = models.UUIDField(null=True, blank=True)  # idempotence des envois (retry reseau)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "messaging_message"
        constraints = [
            models.UniqueConstraint(fields=["conversation", "seq"], name="uniq_message_conv_seq"),
            models.UniqueConstraint(fields=["conversation", "sender", "client_msg_id"], condition=Q(client_msg_id__isnull=False), name="uniq_message_client_id"),
            models.CheckConstraint(condition=~Q(kind="text") | ~Q(body=""), name="chk_message_text_nonempty"),
        ]
        indexes = [
            # PAS d'index (conversation, -seq) : la contrainte UNIQUE(conversation, seq) fournit deja l'index qui sert
            # la pagination curseur (WHERE conversation_id=? AND seq<? ORDER BY seq DESC) via un scan arriere. Verifie par EXPLAIN (tests).
            models.Index(fields=["thread_root", "seq"], name="message_thread_idx", condition=Q(thread_root__isnull=False)),
            models.Index(fields=["sender", "-created_at"], name="message_sender_idx"),
        ]


class MessageAttachment(UUIDModel):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachments")
    storage_key = models.CharField(max_length=400)
    filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    size_bytes = models.BigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "messaging_attachment"
        constraints = [models.CheckConstraint(condition=Q(size_bytes__gte=0), name="chk_attachment_size")]
        indexes = [models.Index(fields=["message"], name="attachment_message_idx")]


class MessageReaction(UUIDModel):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "messaging_reaction"
        constraints = [models.UniqueConstraint(fields=["message", "user", "emoji"], name="uniq_message_reaction")]


class MessageEditHistory(models.Model):
    id = models.BigAutoField(primary_key=True)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="edits")
    previous_body = models.TextField()
    edited_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    edited_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "messaging_edit_history"
        indexes = [models.Index(fields=["message", "edited_at"], name="msgedit_message_idx")]


class MessageDeletion(models.Model):
    """'Supprimer pour moi' : masque le message pour UN utilisateur. (Suppression pour tous = champs
    deleted_* de Message, car un seul etat partage.)"""

    id = models.BigAutoField(primary_key=True)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="hidden_for")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    deleted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "messaging_deletion"
        constraints = [models.UniqueConstraint(fields=["message", "user"], name="uniq_message_hidden")]


class Mention(models.Model):
    id = models.BigAutoField(primary_key=True)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="mentions")
    mentioned_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="message_mentions")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "messaging_mention"
        constraints = [models.UniqueConstraint(fields=["message", "mentioned_user"], name="uniq_message_mention")]
        indexes = [models.Index(fields=["mentioned_user", "-created_at"], name="mention_user_idx")]
