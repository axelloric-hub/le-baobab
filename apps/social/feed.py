"""Moteur de feed HYBRIDE.
 - fan-out-on-WRITE pour les auteurs 'normaux' (audience <= FANOUT_MAX_AUDIENCE) : l'ID du post est pousse dans la
   timeline Redis (ZSET) de chaque destinataire -> lecture O(log n).
 - fan-out-on-READ pour les 'celebrites' (audience > seuil) et pour les groupes : tires depuis PostgreSQL a la lecture.
   (evite 1 post = 1 000 000 ecritures Redis).
 - Redis ne contient que des IDs, plafonnes et avec TTL : tout est reconstructible (rebuild_timeline).
 - La VISIBILITE est TOUJOURS re-verifiee en base a la lecture (un ZSET perime ne peut pas faire fuiter un post).
 - MongoDB `post_cards` : read-model denormalise (auteur, medias, hashtags, compteurs) pour hydrater sans jointures.
Le classement est une fonction pure (rank_score), testable et remplacable par le futur moteur de recommandation."""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone as dt_tz
from typing import Iterable

from django.db.models import Q
from django.utils import timezone

from apps.community.models import GroupMember
from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.choices import Visibility
from apps.core.mongo import collection
from apps.friends import selectors as friend_sel
from apps.friends.models import CloseFriend, Follow
from apps.social.models import Post, PostAudience
from apps.social.selectors import visible_posts

FANOUT_MAX_AUDIENCE = 2000
TIMELINE_MAX = 800
HALF_LIFE_HOURS = 24.0
CARDS = "post_cards"


def rank_score(*, age_hours: float, reactions: int, comments: int, shares: int, affinity: float = 0.0, sponsored_boost: float = 0.0) -> float:
    """score = (1 + engagement) x decroissance(24 h) x (1 + affinite) + boost. Pure et deterministe."""
    engagement = math.log1p(max(reactions, 0) + 3 * max(comments, 0) + 5 * max(shares, 0))
    recency = 0.5 ** (max(age_hours, 0.0) / HALF_LIFE_HOURS)
    return (1.0 + engagement) * recency * (1.0 + max(affinity, 0.0)) + sponsored_boost


def _recipients(post: Post) -> set | None:
    """Destinataires de la timeline ; None => pas de fan-out (pull a la lecture)."""
    a = post.author_id
    if post.group_id or post.visibility in (Visibility.PRIVATE, Visibility.GROUP_MEMBERS):
        return None
    friends = set(friend_sel.friend_ids(a))
    if post.visibility == Visibility.FRIENDS:
        out = friends
    elif post.visibility == Visibility.CLOSE_FRIENDS:
        out = set(CloseFriend.objects.filter(owner_id=a).values_list("friend_id", flat=True)) & friends
    elif post.visibility == Visibility.CUSTOM:
        out = set(PostAudience.objects.filter(post=post).values_list("user_id", flat=True))
    elif post.visibility == Visibility.FOLLOWERS:
        out = set(friend_sel.follower_ids(a))
    else:  # PUBLIC
        out = friends | set(friend_sel.follower_ids(a))
    return out


def fanout_post(post_id) -> int:
    """Pousse le post dans les timelines. Retourne le nombre de timelines alimentees (0 si mode pull)."""
    post = Post.objects.filter(pk=post_id, status=Post.Status.PUBLISHED, deleted_at__isnull=True).first()
    if not post:
        return 0
    recipients = _recipients(post)
    r = R.get_redis()
    if recipients is None:
        return 0
    if len(recipients) > FANOUT_MAX_AUDIENCE:
        r.sadd(K.celebrity_authors(), str(post.author_id))
        return 0
    score, pid = post.published_at.timestamp(), str(post.pk)
    pipe = r.pipeline(transaction=False)
    for uid in recipients | {post.author_id}:
        key = K.feed(uid)
        pipe.zadd(key, {pid: score})
        pipe.zremrangebyrank(key, 0, -(TIMELINE_MAX + 1))
        pipe.expire(key, K.TTL_FEED_CACHE * 96)  # ~24 h
    pipe.execute()
    return len(recipients)


def rebuild_timeline(user_id, days: int = 7) -> int:
    """Reconstruction depuis PostgreSQL (cold start, eviction, failover)."""
    since = timezone.now() - timedelta(days=days)
    authors = set(friend_sel.friend_ids(user_id)) | set(Follow.objects.filter(follower_id=user_id).values_list("followee_id", flat=True)) | {user_id}
    groups = GroupMember.objects.filter(user_id=user_id).values_list("group_id", flat=True)
    rows = list(
        visible_posts(user_id).filter(published_at__gte=since).filter(Q(author_id__in=authors) | Q(group_id__in=groups))
        .order_by("-published_at").values_list("pk", "published_at")[:TIMELINE_MAX]
    )
    key = K.feed(user_id)
    r = R.get_redis()
    pipe = r.pipeline()
    pipe.delete(key)
    if rows:
        pipe.zadd(key, {str(pk): ts.timestamp() for pk, ts in rows})
        pipe.expire(key, K.TTL_FEED_CACHE * 96)
    pipe.execute()
    return len(rows)


@dataclass
class FeedPage:
    posts: list[dict]
    next_cursor: float | None


def _candidate_ids(user_id, limit: int, before: float | None) -> list[str]:
    r = R.get_redis()
    key = K.feed(user_id)
    if not r.exists(key):
        rebuild_timeline(user_id)
    max_score = f"({before}" if before else "+inf"
    ids = r.zrevrangebyscore(key, max_score, "-inf", start=0, num=limit * 3)
    # PULL : celebrites suivies + groupes (jamais pousses)
    celeb = {c for c in r.smembers(K.celebrity_authors())}
    followed_celeb = [a for a in Follow.objects.filter(follower_id=user_id, followee_id__in=list(celeb)).values_list("followee_id", flat=True)] if celeb else []
    groups = GroupMember.objects.filter(user_id=user_id).values_list("group_id", flat=True)
    pull = visible_posts(user_id).filter(Q(author_id__in=followed_celeb) | Q(group_id__in=groups))
    if before:
        pull = pull.filter(published_at__lt=datetime.fromtimestamp(before, tz=dt_tz.utc))
    ids += [str(pk) for pk in pull.order_by("-published_at").values_list("pk", flat=True)[: limit * 2]]
    return list(dict.fromkeys(ids))


def get_feed(user_id, limit: int = 30, before: float | None = None, now: datetime | None = None) -> FeedPage:
    now = now or timezone.now()
    ids = _candidate_ids(user_id, limit, before)
    if not ids:
        return FeedPage([], None)
    # Re-verification de visibilite en base (index-only sur la PK).
    allowed = {str(p.pk): p for p in visible_posts(user_id).filter(pk__in=ids).only("pk", "author_id", "published_at", "reaction_count", "comment_count", "share_count")}
    close = set(map(str, CloseFriend.objects.filter(friend_id=user_id).values_list("owner_id", flat=True)))
    friends = set(map(str, friend_sel.friend_ids(user_id)))
    hidden = set(map(str, friend_sel.users_hidden_from(user_id)))
    scored = []
    for pid in ids:
        p = allowed.get(pid)
        if not p or str(p.author_id) in hidden:
            continue
        age_h = (now - p.published_at).total_seconds() / 3600
        affinity = 0.5 if str(p.author_id) in close else 0.25 if str(p.author_id) in friends else 0.0
        scored.append((rank_score(age_hours=age_h, reactions=p.reaction_count, comments=p.comment_count, shares=p.share_count, affinity=affinity), p))
    scored.sort(key=lambda t: t[0], reverse=True)
    page = scored[:limit]
    # Le curseur est temporel (borne basse du lot) : on classe A L'INTERIEUR d'une fenetre, jamais d'offset instable.
    cursor = min((p.published_at.timestamp() for _, p in page), default=None) if len(scored) > 0 else None
    return FeedPage(hydrate([str(p.pk) for _, p in page]), cursor)


# ----------------------------------------------------------------------------- read model Mongo
def build_card(post: Post) -> dict:
    prof = getattr(post.author, "profile", None)
    return {
        "_id": str(post.pk),
        "schema_version": 1,
        "author": {"id": str(post.author_id), "username": post.author.username,
                   "display_name": prof.display_name if prof else post.author.username, "avatar_key": prof.avatar_key if prof else ""},
        "kind": post.kind, "title": post.title, "body": post.body[:500], "visibility": post.visibility,
        "group_id": str(post.group_id) if post.group_id else None,
        "payload": post.payload,
        "media": [{"kind": m.kind, "key": m.storage_key, "w": m.width, "h": m.height, "alt": m.alt_text}
                  for m in post.media.all().order_by("position")],
        "hashtags": sorted(post.post_hashtags.values_list("hashtag__tag", flat=True)),
        "counters": {"reactions": post.reaction_count, "comments": post.comment_count, "shares": post.share_count,
                     "saves": post.save_count, "views": post.view_count},
        "published_at": post.published_at, "updated_at": timezone.now(),
    }


def project_post_card(post_id) -> None:
    post = Post.objects.select_related("author__profile").filter(pk=post_id, deleted_at__isnull=True).first()
    if post:
        card = build_card(post)
        collection(CARDS).replace_one({"_id": card["_id"]}, card, upsert=True)


def delete_post_card(post_id) -> None:
    collection(CARDS).delete_one({"_id": str(post_id)})


def update_card_counters(post_id) -> None:
    row = Post.objects.filter(pk=post_id).values("reaction_count", "comment_count", "share_count", "save_count", "view_count").first()
    if row:
        collection(CARDS).update_one({"_id": str(post_id)}, {"$set": {"counters": {
            "reactions": row["reaction_count"], "comments": row["comment_count"], "shares": row["share_count"],
            "saves": row["save_count"], "views": row["view_count"]}}})


def hydrate(post_ids: Iterable[str]) -> list[dict]:
    """Cartes dans l'ordre demande. Carte absente (perte Mongo, retard outbox) => reconstruction a la volee depuis PG."""
    ids = list(post_ids)
    found = {d["_id"]: d for d in collection(CARDS).find({"_id": {"$in": ids}})}
    for pid in ids:
        if pid not in found:
            project_post_card(pid)
            doc = collection(CARDS).find_one({"_id": pid})
            if doc:
                found[pid] = doc
    return [found[i] for i in ids if i in found]
