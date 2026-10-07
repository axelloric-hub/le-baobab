from __future__ import annotations

from django.db.models import F, OuterRef, QuerySet, Subquery

from apps.messaging.models import Conversation, ConversationMember, Message


def membership(user_id, conversation_id) -> ConversationMember | None:
    return ConversationMember.objects.filter(user_id=user_id, conversation_id=conversation_id, left_at__isnull=True).first()


def is_member(user_id, conversation_id) -> bool:
    return ConversationMember.objects.filter(user_id=user_id, conversation_id=conversation_id, left_at__isnull=True).exists()


def inbox(user_id) -> QuerySet:
    """Boite de reception triee par activite, unread calcule en SQL = message_seq - last_read_seq (O(1)/ligne)."""
    return (
        ConversationMember.objects.filter(user_id=user_id, left_at__isnull=True, is_archived=False)
        .select_related("conversation")
        .annotate(unread=F("conversation__message_seq") - F("last_read_seq"), last_at=F("conversation__last_message_at"))
        .order_by(F("last_at").desc(nulls_last=True), "-conversation_id")
    )


def history(conversation_id, user_id) -> QuerySet:
    """Messages visibles par l'utilisateur (hors supprimes pour tous / pour lui), prets pour curseur (-seq)."""
    return (
        Message.objects.filter(conversation_id=conversation_id, deleted_at__isnull=True, thread_root__isnull=True)
        .exclude(hidden_for__user_id=user_id)
        .select_related("sender__profile")
        .prefetch_related("attachments", "reactions")
    )


def thread(root_id, user_id) -> QuerySet:
    return Message.objects.filter(thread_root_id=root_id, deleted_at__isnull=True).exclude(hidden_for__user_id=user_id).order_by("seq")


def read_receipt_summary(conversation_id, seq: int) -> int:
    """Nombre de membres ayant lu au moins jusqu'a `seq`."""
    return ConversationMember.objects.filter(conversation_id=conversation_id, last_read_seq__gte=seq).count()
