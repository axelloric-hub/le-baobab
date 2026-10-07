from __future__ import annotations

import re
from typing import Iterable

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.friends.selectors import are_friends, is_blocked_either_way
from apps.messaging.models import (
    Conversation, ConversationMember, Mention, Message, MessageAttachment, MessageDeletion, MessageEditHistory, MessageReaction,
)

MENTION_RE = re.compile(r"(?<![\w@])@([a-z0-9][a-z0-9_.]{2,29})")
EDIT_WINDOW_HOURS = 48


@transaction.atomic
def get_or_create_direct(user, other) -> tuple[Conversation, bool]:
    if user.pk == other.pk:
        raise DomainError("Conversation avec soi-meme impossible.", code="self_relation")
    if is_blocked_either_way(user.pk, other.pk):
        raise PermissionDeniedError("Action impossible.", code="blocked")
    rule = other.privacy.who_can_message
    if rule == "nobody" or (rule == "friends" and not are_friends(user.pk, other.pk)):
        raise PermissionDeniedError("Cet utilisateur n'accepte pas vos messages.", code="messaging_restricted")
    key = Conversation.make_direct_key(user.pk, other.pk)
    conv = Conversation.objects.filter(direct_key=key).first()
    if conv:
        return conv, False
    try:
        with transaction.atomic():
            conv = Conversation.objects.create(type=Conversation.Type.DIRECT, direct_key=key, created_by=user)
    except IntegrityError:  # creation concurrente : on prend la gagnante
        return Conversation.objects.get(direct_key=key), False
    ConversationMember.objects.bulk_create([ConversationMember(conversation=conv, user=user), ConversationMember(conversation=conv, user=other)])
    return conv, True


@transaction.atomic
def create_group_conversation(creator, members: Iterable, title: str = "") -> Conversation:
    conv = Conversation.objects.create(type=Conversation.Type.GROUP, title=title, created_by=creator)
    users = {creator.pk: creator, **{m.pk: m for m in members}}
    ConversationMember.objects.bulk_create(
        [ConversationMember(conversation=conv, user=u, role="admin" if u.pk == creator.pk else "member") for u in users.values()]
    )
    return conv


def _extract_mentions(body: str, conversation: Conversation) -> list:
    from apps.accounts.models import User

    names = {n.lower() for n in MENTION_RE.findall(body)}
    if not names:
        return []
    return list(User.objects.filter(username__in=names, conversation_memberships__conversation=conversation,
                                    conversation_memberships__left_at__isnull=True).distinct())


@transaction.atomic
def send_message(*, conversation_id, sender, body: str = "", kind: str = Message.Kind.TEXT, reply_to_id=None,
                 thread_root_id=None, client_msg_id=None, attachments: list[dict] | None = None, metadata: dict | None = None) -> Message:
    """Ecrit le message (seq attribue par trigger), mentions, pieces jointes, evenement outbox. Idempotent sur client_msg_id."""
    member = ConversationMember.objects.filter(conversation_id=conversation_id, user=sender, left_at__isnull=True).select_related("conversation").first()
    if not member:
        raise PermissionDeniedError("Vous n'etes pas membre de cette conversation.")
    conv = member.conversation
    if conv.type == Conversation.Type.DIRECT:
        other_id = next(m for m in conv.members.values_list("user_id", flat=True) if m != sender.pk)
        if is_blocked_either_way(sender.pk, other_id):
            raise PermissionDeniedError("Action impossible.", code="blocked")
    if client_msg_id:
        dup = Message.objects.filter(conversation=conv, sender=sender, client_msg_id=client_msg_id).first()
        if dup:
            return dup
    if reply_to_id and not Message.objects.filter(pk=reply_to_id, conversation=conv).exists():
        raise DomainError("Message cible introuvable dans cette conversation.", code="invalid_reply")
    if thread_root_id:
        root = Message.objects.filter(pk=thread_root_id, conversation=conv, thread_root__isnull=True).first()
        if not root:
            raise DomainError("Thread invalide.", code="invalid_thread")
    try:
        with transaction.atomic():
            msg = Message.objects.create(conversation=conv, sender=sender, body=body, kind=kind, reply_to_id=reply_to_id,
                                         thread_root_id=thread_root_id, client_msg_id=client_msg_id, metadata=metadata or {})
    except IntegrityError:
        existing = Message.objects.filter(conversation=conv, sender=sender, client_msg_id=client_msg_id).first()
        if existing:
            return existing
        raise
    msg.refresh_from_db(fields=["seq", "created_at"])  # seq vient du trigger
    for a in attachments or []:
        MessageAttachment.objects.create(message=msg, **a)
    mentioned = _extract_mentions(body, conv)
    Mention.objects.bulk_create([Mention(message=msg, mentioned_user=u) for u in mentioned])
    # L'expediteur a lu son propre message.
    ConversationMember.objects.filter(pk=member.pk).update(last_read_seq=msg.seq, last_delivered_seq=msg.seq)
    publish_event("MessageSent", "message", msg.pk,
                  {"conversation": str(conv.pk), "seq": msg.seq, "sender": str(sender.pk), "mentions": [str(u.pk) for u in mentioned]})
    transaction.on_commit(lambda: _after_commit_send(conv.pk, sender.pk, msg.pk, msg.seq))
    return msg


def _after_commit_send(conversation_id, sender_id, message_id, seq: int) -> None:
    """Effets Redis/temps reel APRES commit (jamais de diffusion d'un message qui pourrait etre annule)."""
    try:
        r = R.get_redis()
        key = K.conversation_unread(conversation_id)
        pipe = r.pipeline()
        for uid in ConversationMember.objects.filter(conversation_id=conversation_id, left_at__isnull=True).exclude(user_id=sender_id).values_list("user_id", flat=True):
            pipe.hincrby(key, str(uid), 1)
        pipe.expire(key, K.TTL_UNREAD)
        pipe.execute()
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(f"conv.{conversation_id}", {"type": "chat.message", "message_id": str(message_id), "seq": seq, "sender": str(sender_id)})
    except Exception:  # noqa: BLE001 - le temps reel est best-effort ; la verite est en base
        import logging
        logging.getLogger(__name__).warning("realtime fan-out failed", exc_info=True)


@transaction.atomic
def mark_read(conversation_id, user, up_to_seq: int) -> ConversationMember:
    member = ConversationMember.objects.select_for_update().select_related("conversation").get(conversation_id=conversation_id, user=user, left_at__isnull=True)
    seq = min(up_to_seq, member.conversation.message_seq)
    if seq > member.last_read_seq:  # monotone : on ne recule jamais
        member.last_read_seq = seq
        member.last_delivered_seq = max(member.last_delivered_seq, seq)
        member.save(update_fields=["last_read_seq", "last_delivered_seq"])
        transaction.on_commit(lambda: R.get_redis().hdel(K.conversation_unread(conversation_id), str(user.pk)))
    return member


@transaction.atomic
def mark_delivered(conversation_id, user, up_to_seq: int) -> None:
    ConversationMember.objects.filter(conversation_id=conversation_id, user=user, last_delivered_seq__lt=up_to_seq).update(last_delivered_seq=up_to_seq)


@transaction.atomic
def edit_message(message_id, editor, new_body: str) -> Message:
    msg = Message.objects.select_for_update().get(pk=message_id)
    if msg.sender_id != editor.pk:
        raise PermissionDeniedError("Seul l'auteur peut modifier ce message.")
    if msg.deleted_at:
        raise DomainError("Message supprime.", code="deleted")
    if (timezone.now() - msg.created_at).total_seconds() > EDIT_WINDOW_HOURS * 3600:
        raise DomainError("Delai de modification depasse.", code="edit_window_expired")
    if not new_body.strip():
        raise DomainError("Message vide.", code="empty")
    MessageEditHistory.objects.create(message=msg, previous_body=msg.body, edited_by=editor)
    msg.body, msg.edited_at = new_body, timezone.now()
    msg.save(update_fields=["body", "edited_at"])
    publish_event("MessageEdited", "message", msg.pk, {"conversation": str(msg.conversation_id)})
    return msg


@transaction.atomic
def delete_message(message_id, actor, *, for_everyone: bool, reason: str = "") -> None:
    msg = Message.objects.select_for_update().get(pk=message_id)
    if not ConversationMember.objects.filter(conversation_id=msg.conversation_id, user=actor, left_at__isnull=True).exists():
        raise PermissionDeniedError("Acces refuse.")
    if for_everyone:
        if msg.sender_id != actor.pk:
            raise PermissionDeniedError("Seul l'auteur peut supprimer pour tous.")
        msg.deleted_at, msg.deleted_by, msg.deletion_reason = timezone.now(), actor, reason
        msg.save(update_fields=["deleted_at", "deleted_by", "deletion_reason"])
        publish_event("MessageDeleted", "message", msg.pk, {"conversation": str(msg.conversation_id)})
    else:
        MessageDeletion.objects.get_or_create(message=msg, user=actor)


@transaction.atomic
def toggle_reaction(message_id, user, emoji: str) -> bool:
    """Retourne True si ajoutee, False si retiree."""
    msg = Message.objects.get(pk=message_id)
    if not ConversationMember.objects.filter(conversation_id=msg.conversation_id, user=user, left_at__isnull=True).exists():
        raise PermissionDeniedError("Acces refuse.")
    deleted, _ = MessageReaction.objects.filter(message=msg, user=user, emoji=emoji).delete()
    if deleted:
        return False
    MessageReaction.objects.get_or_create(message=msg, user=user, emoji=emoji)
    return True
