from __future__ import annotations

import re
from datetime import timedelta
from typing import Iterable

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.community.selectors import can, can_view_group_content, is_muted
from apps.core import redis as R
from apps.core.choices import Visibility
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event
from apps.social.models import (
    Comment, CommentReaction, Hashtag, Poll, PollOption, PollVote, Post, PostAudience, PostEditHistory, PostHashtag,
    PostMedia, PostMention, PostReaction, Save, Share, Status, StatusAudience, StatusReaction, StatusView,
)
from apps.social.selectors import active_statuses_for, can_view_post

HASHTAG_RE = re.compile(r"(?<![\w#])#([A-Za-z0-9_\u00C0-\u024F]{2,50})")
MENTION_RE = re.compile(r"(?<![\w@])@([a-z0-9][a-z0-9_.]{2,29})")
MAX_MEDIA = 10
STATUS_TTL = timedelta(hours=24)


def extract_hashtags(text: str) -> set[str]:
    return {m.lower() for m in HASHTAG_RE.findall(text or "")}


@transaction.atomic
def create_post(*, author, kind: str = Post.Kind.TEXT, body: str = "", title: str = "", visibility: str | None = None,
                group=None, payload: dict | None = None, media: Iterable[dict] = (), audience_user_ids: Iterable = (),
                poll: dict | None = None, ref_type: str = "", ref_id=None) -> Post:
    """Cree un post complet (media, hashtags, mentions, audience, sondage) + evenement outbox PostCreated, atomiquement."""
    from apps.accounts.models import User

    visibility = visibility or author.privacy.default_post_visibility
    if group is not None:
        if not can_view_group_content(author.pk, group) or not can(author.pk, group.pk, "post.create") or is_muted(author.pk, group.pk):
            raise PermissionDeniedError("Vous ne pouvez pas publier dans ce groupe.", code="group_post_forbidden")
        if visibility != Visibility.GROUP_MEMBERS and group.privacy != "public":
            visibility = Visibility.GROUP_MEMBERS  # un groupe prive ne fuit jamais vers le public
    elif visibility == Visibility.GROUP_MEMBERS:
        raise DomainError("Un groupe est requis pour cette visibilite.", code="group_required")
    media = list(media)
    if len(media) > MAX_MEDIA:
        raise DomainError(f"Maximum {MAX_MEDIA} medias par publication.", code="too_many_media")
    if kind == Post.Kind.POLL and not poll:
        raise DomainError("Un sondage doit definir ses options.", code="poll_required")
    post = Post.objects.create(author=author, kind=kind, body=body, title=title, visibility=visibility, group=group,
                               community=group.community if group else None, payload=payload or {}, ref_type=ref_type, ref_id=ref_id)
    PostMedia.objects.bulk_create([PostMedia(post=post, position=i, **m) for i, m in enumerate(media)])
    _sync_hashtags(post, extract_hashtags(f"{title} {body}"))
    names = {n.lower() for n in MENTION_RE.findall(body)}
    if names:
        PostMention.objects.bulk_create([PostMention(post=post, user=u) for u in User.objects.filter(username__in=names)], ignore_conflicts=True)
    if visibility == Visibility.CUSTOM:
        PostAudience.objects.bulk_create([PostAudience(post=post, user_id=uid) for uid in set(audience_user_ids)], ignore_conflicts=True)
    if poll:
        _create_poll(post, poll)
    publish_event("PostCreated", "post", post.pk, {"author": str(author.pk), "visibility": visibility, "group": str(group.pk) if group else None})
    return post


def _sync_hashtags(post: Post, tags: set[str]) -> None:
    for tag in tags:
        h, _ = Hashtag.objects.get_or_create(tag=tag)
        PostHashtag.objects.get_or_create(post=post, hashtag=h)  # post_count mis a jour par trigger


def _create_poll(post: Post, spec: dict) -> Poll:
    options = [o.strip() for o in spec.get("options", []) if o and o.strip()]
    if not 2 <= len(options) <= 10:
        raise DomainError("Un sondage necessite entre 2 et 10 options.", code="poll_options")
    poll = Poll.objects.create(post=post, question=spec["question"], allows_multiple=spec.get("allows_multiple", False),
                               is_anonymous=spec.get("is_anonymous", False), closes_at=spec.get("closes_at"))
    PollOption.objects.bulk_create([PollOption(poll=poll, label=o, position=i) for i, o in enumerate(options)])
    return poll


@transaction.atomic
def edit_post(post_id, editor, *, body: str | None = None, title: str | None = None, payload: dict | None = None) -> Post:
    post = Post.objects.select_for_update().get(pk=post_id, deleted_at__isnull=True)
    if post.author_id != editor.pk:
        raise PermissionDeniedError("Seul l'auteur peut modifier cette publication.")
    PostEditHistory.objects.create(post=post, previous_title=post.title, previous_body=post.body, previous_payload=post.payload, edited_by=editor)
    if body is not None: post.body = body
    if title is not None: post.title = title
    if payload is not None: post.payload = payload
    post.edited_at = timezone.now()
    post.save()
    PostHashtag.objects.filter(post=post).delete()
    _sync_hashtags(post, extract_hashtags(f"{post.title} {post.body}"))
    publish_event("PostEdited", "post", post.pk, {})
    return post


@transaction.atomic
def delete_post(post_id, actor, reason: str = "") -> Post:
    post = Post.objects.select_for_update().get(pk=post_id, deleted_at__isnull=True)
    allowed = post.author_id == actor.pk or (post.group_id and can(actor.pk, post.group_id, "post.delete_any"))
    if not allowed:
        raise PermissionDeniedError("Suppression non autorisee.")
    post.deleted_at, post.deleted_by, post.deletion_reason = timezone.now(), actor, reason
    post.save(update_fields=["deleted_at", "deleted_by", "deletion_reason"])
    publish_event("PostDeleted", "post", post.pk, {"author": str(post.author_id)})
    return post


@transaction.atomic
def react_to_post(post_id, user, reaction_type: str | None) -> PostReaction | None:
    """Pose/change/retire (type=None) la reaction. Idempotent ; compteur maintenu par trigger."""
    if not can_view_post(user.pk, post_id):
        raise PermissionDeniedError("Publication inaccessible.", code="not_visible")
    if reaction_type is None:
        PostReaction.objects.filter(post_id=post_id, user=user).delete()
        return None
    obj, created = PostReaction.objects.update_or_create(post_id=post_id, user=user, defaults={"type": reaction_type})
    if created:
        publish_event("PostLiked", "post", post_id, {"user": str(user.pk), "type": reaction_type})
    return obj


@transaction.atomic
def add_comment(post_id, author, body: str, parent_id=None) -> Comment:
    if not can_view_post(author.pk, post_id):
        raise PermissionDeniedError("Publication inaccessible.", code="not_visible")
    post = Post.objects.get(pk=post_id)
    if not post.comments_enabled:
        raise DomainError("Les commentaires sont desactives.", code="comments_disabled")
    if post.group_id and is_muted(author.pk, post.group_id):
        raise PermissionDeniedError("Vous etes en sourdine dans ce groupe.", code="muted")
    depth = 0
    if parent_id:
        parent = Comment.objects.get(pk=parent_id, post_id=post_id, deleted_at__isnull=True)
        depth = min(parent.depth + 1, 2)
        if parent.depth >= 2:  # a profondeur max, on rattache au parent de ce niveau
            parent_id, depth = parent.parent_id, 2
    c = Comment.objects.create(post_id=post_id, author=author, body=body, parent_id=parent_id, depth=depth)
    publish_event("CommentCreated", "comment", c.pk, {"post": str(post_id), "author": str(author.pk), "post_author": str(post.author_id)})
    return c


@transaction.atomic
def react_to_comment(comment_id, user, reaction_type: str | None):
    c = Comment.objects.get(pk=comment_id, deleted_at__isnull=True)
    if not can_view_post(user.pk, c.post_id):
        raise PermissionDeniedError("Publication inaccessible.", code="not_visible")
    if reaction_type is None:
        CommentReaction.objects.filter(comment=c, user=user).delete()
        return None
    return CommentReaction.objects.update_or_create(comment=c, user=user, defaults={"type": reaction_type})[0]


@transaction.atomic
def share_post(post_id, user, comment: str = "", visibility: str = Visibility.PUBLIC) -> Share:
    if not can_view_post(user.pk, post_id):
        raise PermissionDeniedError("Publication inaccessible.", code="not_visible")
    share, created = Share.objects.get_or_create(user=user, post_id=post_id, defaults={"comment": comment, "visibility": visibility})
    if created:
        publish_event("PostShared", "post", post_id, {"user": str(user.pk)})
    return share


@transaction.atomic
def save_post(post_id, user, collection: str = "") -> Save:
    if not can_view_post(user.pk, post_id):
        raise PermissionDeniedError("Publication inaccessible.", code="not_visible")
    return Save.objects.get_or_create(user=user, post_id=post_id, defaults={"collection": collection})[0]


def unsave_post(post_id, user) -> None:
    Save.objects.filter(post_id=post_id, user=user).delete()


def record_view(post_id, viewer_id, *, dedup_ttl: int = 3600) -> bool:
    """Vue = signal a fort volume : JAMAIS une ligne PostgreSQL. Redis (dedup 1h/viewer + compteur) -> flush periodique
    vers social_post.view_count ; l'evenement analytique detaille part dans MongoDB (analytics)."""
    r = R.get_redis()
    from apps.core import redis_keys as K

    if not r.set(K.dedup("post_view", f"{post_id}:{viewer_id}"), 1, nx=True, ex=dedup_ttl):
        return False
    R.incr_counter("post_view", post_id)
    return True


@transaction.atomic
def vote_poll(poll_post_id, user, option_ids: list) -> list[PollVote]:
    poll = Poll.objects.select_for_update().get(pk=poll_post_id)
    if not can_view_post(user.pk, poll_post_id):
        raise PermissionDeniedError("Sondage inaccessible.", code="not_visible")
    if poll.closes_at and poll.closes_at < timezone.now():
        raise DomainError("Sondage clos.", code="poll_closed")
    option_ids = list(dict.fromkeys(option_ids))
    if not option_ids or (len(option_ids) > 1 and not poll.allows_multiple):
        raise DomainError("Selection invalide.", code="invalid_choice")
    valid = set(PollOption.objects.filter(poll=poll, pk__in=option_ids).values_list("pk", flat=True))
    if valid != set(option_ids):
        raise DomainError("Option inconnue.", code="invalid_option")
    if PollVote.objects.filter(poll=poll, user=user).exists():
        raise ConflictError("Vous avez deja vote.", code="already_voted")  # verrou ligne poll => pas de double vote
    return [PollVote.objects.create(poll=poll, option_id=o, user=user) for o in option_ids]


@transaction.atomic
def create_status(*, author, kind: str = Status.Kind.TEXT, body: str = "", visibility: str | None = None, storage_key: str = "",
                  mime_type: str = "", link_url: str = "", style: dict | None = None, audience_user_ids: Iterable = (),
                  ttl: timedelta = STATUS_TTL) -> Status:
    visibility = visibility or author.privacy.default_status_visibility
    now = timezone.now()
    s = Status.objects.create(author=author, kind=kind, body=body, storage_key=storage_key, mime_type=mime_type, link_url=link_url,
                              style=style or {}, visibility=visibility, created_at=now, expires_at=now + ttl)
    if visibility == Visibility.CUSTOM:
        StatusAudience.objects.bulk_create([StatusAudience(status=s, user_id=u) for u in set(audience_user_ids)], ignore_conflicts=True)
    publish_event("StatusCreated", "status", s.pk, {"author": str(author.pk)})
    return s


@transaction.atomic
def view_status(status_id, viewer) -> bool:
    if not active_statuses_for(viewer.pk).filter(pk=status_id).exists():
        raise PermissionDeniedError("Statut indisponible.", code="not_visible")
    s = Status.objects.get(pk=status_id)
    if s.author_id == viewer.pk:
        return False
    try:
        with transaction.atomic():
            StatusView.objects.create(status=s, viewer=viewer)
    except IntegrityError:
        return False
    Status.objects.filter(pk=s.pk).update(view_count=F("view_count") + 1)
    return True


@transaction.atomic
def react_to_status(status_id, user, emoji: str) -> StatusReaction:
    if not active_statuses_for(user.pk).filter(pk=status_id).exists():
        raise PermissionDeniedError("Statut indisponible.", code="not_visible")
    return StatusReaction.objects.update_or_create(status_id=status_id, user=user, defaults={"emoji": emoji})[0]


def archive_expired_statuses(batch: int = 1000) -> int:
    """Job periodique : marque comme archives les statuts expires (pas de DELETE : l'historique/moderation reste)."""
    ids = list(Status.objects.filter(expires_at__lte=timezone.now(), archived_at__isnull=True).values_list("pk", flat=True)[:batch])
    return Status.objects.filter(pk__in=ids).update(archived_at=timezone.now())
