"""Messagerie REST. Le temps reel passe par WebSocket (/ws/conversations/<id>/ et /ws/notifications/) ; ces endpoints servent l'historique et l'envoi."""
from __future__ import annotations

from collections import Counter

from rest_framework import serializers as s
from rest_framework.response import Response

from apps.core.api import endpoint, get_or_404, paginate
from apps.messaging import selectors as MS
from apps.messaging import services as MV
from apps.messaging.models import Conversation, ConversationMember, Message
from apps.profiles.render import user_brief
from apps.profiles.selectors import get_active_or_404 as _u
from apps.storage.services import resolve_owned, signed_url


def _member(user, conversation_id) -> ConversationMember:
    return get_or_404(ConversationMember.objects.filter(conversation_id=conversation_id, user=user, left_at__isnull=True).select_related("conversation"))


def _msg(m: Message) -> dict:
    return {"id": str(m.pk), "seq": m.seq, "sender": user_brief(m.sender) if m.sender else None, "kind": m.kind, "body": m.body, "metadata": m.metadata,
            "reply_to": str(m.reply_to_id) if m.reply_to_id else None, "thread_root": str(m.thread_root_id) if m.thread_root_id else None, "reply_count": m.reply_count,
            "edited_at": m.edited_at, "created_at": m.created_at,
            "attachments": [{"filename": a.filename, "content_type": a.mime_type, "size_bytes": a.size_bytes, "url": signed_url(a.storage_key, a.filename)} for a in m.attachments.all()],
            "reactions": dict(Counter(r.emoji for r in m.reactions.all()))}


def _conv(m: ConversationMember, others: dict) -> dict:
    c = m.conversation
    other = others.get(c.pk)
    return {"id": str(c.pk), "type": c.type, "title": c.title or (other["display_name"] if other else ""), "with": other, "unread": max(m.unread, 0), "last_message_at": c.last_message_at,
            "last_read_seq": m.last_read_seq, "message_seq": c.message_seq}


@endpoint("Ma boite de reception (conversations triees par activite, avec le nombre de non-lus).")
def inbox(request):
    page = list(MS.inbox(request.user.pk)[:100])
    direct_ids = [m.conversation_id for m in page if m.conversation.type == "direct"]
    others = {c.conversation_id: user_brief(c.user) for c in ConversationMember.objects.filter(conversation_id__in=direct_ids).exclude(user=request.user).select_related("user__profile")}
    return [_conv(m, others) for m in page]


@endpoint("Ouvrir (ou retrouver) la conversation directe avec un utilisateur.", status=201, body={"username": s.CharField(max_length=30)})
def open_direct(request):
    conv, created = MV.get_or_create_direct(request.user, _u(request.input["username"]))
    return {"id": str(conv.pk), "created": created}


@endpoint("Creer une conversation de groupe.", status=201, body={"usernames": s.ListField(child=s.CharField(max_length=30), min_length=1, max_length=50), "title": s.CharField(max_length=150, required=False, allow_blank=True)})
def create_group_conversation(request):
    d = request.input
    conv = MV.create_group_conversation(request.user, [_u(n) for n in dict.fromkeys(d["usernames"])], d.get("title", ""))
    return {"id": str(conv.pk)}


@endpoint("Historique d'une conversation, du plus recent au plus ancien (curseur).")
def history(request, conversation_id):
    _member(request.user, conversation_id)
    return paginate(request, MS.history(conversation_id, request.user.pk), ("-seq",), _msg, 50)


@endpoint("Envoyer un message. client_msg_id (UUID) rend l'envoi idempotent : un nouvel essai apres coupure reseau ne cree pas de doublon. attachments : identifiants de fichiers (usage 'message_attachment').", status=201,
          body={"body": s.CharField(max_length=10000, required=False, allow_blank=True, default=""), "kind": s.ChoiceField(choices=[c[0] for c in Message.Kind.choices], default="text"),
                "reply_to": s.UUIDField(required=False), "thread_root": s.UUIDField(required=False), "client_msg_id": s.UUIDField(required=False),
                "attachments": s.ListField(child=s.UUIDField(), max_length=10, required=False), "metadata": s.DictField(required=False)})
def send(request, conversation_id):
    d = request.input
    atts = []
    for fid in d.get("attachments", []):
        f = resolve_owned(request.user, fid, ("message_attachment",))
        atts.append({"storage_key": f.key, "filename": f.filename, "mime_type": f.content_type, "size_bytes": f.size_bytes})
    m = MV.send_message(conversation_id=conversation_id, sender=request.user, body=d["body"], kind=d["kind"], reply_to_id=d.get("reply_to"), thread_root_id=d.get("thread_root"),
                        client_msg_id=d.get("client_msg_id"), attachments=atts, metadata=d.get("metadata"))
    return _msg(Message.objects.prefetch_related("attachments", "reactions").select_related("sender__profile").get(pk=m.pk))


@endpoint("Fil de discussion d'un message.")
def thread(request, conversation_id, message_id):
    _member(request.user, conversation_id)
    root = get_or_404(Message.objects.filter(pk=message_id, conversation_id=conversation_id))
    return [_msg(m) for m in MS.thread(root.pk, request.user.pk).select_related("sender__profile").prefetch_related("attachments", "reactions")[:200]]


@endpoint("Marquer comme lu jusqu'a un numero de message (seq).", body={"up_to_seq": s.IntegerField(min_value=0)})
def mark_read(request, conversation_id):
    _member(request.user, conversation_id)
    m = MV.mark_read(conversation_id, request.user, request.input["up_to_seq"])
    return {"last_read_seq": m.last_read_seq}


@endpoint("Modifier mon message.", body={"body": s.CharField(max_length=10000)})
def edit(request, message_id):
    m = MV.edit_message(message_id, request.user, request.input["body"])
    return _msg(Message.objects.prefetch_related("attachments", "reactions").select_related("sender__profile").get(pk=m.pk))


@endpoint("Supprimer un message : pour moi seulement, ou pour tous (auteur/moderation).", status=204, query={"for_everyone": s.BooleanField(default=False)})
def delete(request, message_id):
    MV.delete_message(message_id, request.user, for_everyone=request.q["for_everyone"])
    return Response(status=204)


@endpoint("Ajouter/retirer une reaction (emoji) a un message.", body={"emoji": s.CharField(max_length=16)})
def react(request, message_id):
    return {"reacted": MV.toggle_reaction(message_id, request.user, request.input["emoji"])}
