"""Publications, commentaires, reactions, partages, statuts ephemeres, feed. La visibilite est calculee en SQL (social.selectors) a CHAQUE lecture."""
from __future__ import annotations

from django.db import connection
from django.utils import timezone
from rest_framework import serializers as s
from rest_framework.response import Response

from apps.community import selectors as CS
from apps.community.models import Group
from apps.core.api import endpoint, get_or_404, paginate
from apps.core.choices import Visibility
from apps.profiles.render import file_url, user_brief
from apps.profiles.selectors import get_active_or_404 as _u
from apps.social import feed as FD
from apps.social import selectors as SS
from apps.social import services as SV
from apps.social.models import Comment, CommentReaction, Poll, PollVote, Post, PostReaction, Save, Status, StatusView
from apps.storage.services import resolve_owned, signed_url

VIS = [c[0] for c in Visibility.choices]


class _PollIn(s.Serializer):
    question = s.CharField(max_length=300)
    options = s.ListField(child=s.CharField(max_length=120), min_length=2, max_length=10)
    allows_multiple = s.BooleanField(default=False)
    is_anonymous = s.BooleanField(default=False)
    closes_at = s.DateTimeField(required=False)


def _vid(request):
    return getattr(request.user, "pk", None)


def _polls(post_ids, viewer_id) -> dict[str, dict]:
    """Sondages des publications donnees : question, options avec leur nombre de votes, et mes votes."""
    polls = {str(p.post_id): p for p in Poll.objects.filter(post_id__in=list(post_ids)).prefetch_related("options")}
    if not polls:
        return {}
    mine: dict[str, list[str]] = {}
    if viewer_id:
        for poll_id, option_id in PollVote.objects.filter(poll_id__in=list(polls), user_id=viewer_id).values_list("poll_id", "option_id"):
            mine.setdefault(str(poll_id), []).append(str(option_id))
    now, out = timezone.now(), {}
    for pid, poll in polls.items():
        options = sorted(poll.options.all(), key=lambda o: o.position)
        out[pid] = {"question": poll.question, "allows_multiple": poll.allows_multiple, "is_anonymous": poll.is_anonymous,
                    "closes_at": poll.closes_at, "closed": bool(poll.closes_at and poll.closes_at < now),
                    "options": [{"id": str(o.pk), "label": o.label, "votes": o.vote_count} for o in options],
                    "total_votes": sum(o.vote_count for o in options), "my_votes": mine.get(pid, [])}
    return out


def _post(p: Post, viewer_id) -> dict:
    mine = PostReaction.objects.filter(post=p, user_id=viewer_id).values_list("type", flat=True).first() if viewer_id else None
    return {"id": str(p.pk), "author": user_brief(p.author), "kind": p.kind, "title": p.title, "body": p.body, "visibility": p.visibility, "group": p.group.slug if p.group_id else None,
            "group_name": p.group.name if p.group_id else None,
            "payload": p.payload, "published_at": p.published_at, "edited_at": p.edited_at,
            "media": [{"kind": m.kind, "url": signed_url(m.storage_key), "width": m.width, "height": m.height, "alt": m.alt_text} for m in p.media.all()],
            "counters": {"reactions": p.reaction_count, "comments": p.comment_count, "shares": p.share_count, "saves": p.save_count, "views": p.view_count},
            "my_reaction": mine, "saved": bool(viewer_id) and Save.objects.filter(post=p, user_id=viewer_id).exists(),
            "poll": _polls([p.pk], viewer_id).get(str(p.pk)) if p.kind == Post.Kind.POLL else None}


def _card(c: dict) -> dict:
    a = c["author"]
    return {"id": c["_id"], "author": {"username": a["username"], "display_name": a["display_name"], "avatar_url": file_url(a.get("avatar_key", ""))}, "kind": c["kind"], "title": c["title"],
            "body": c["body"], "visibility": c["visibility"], "payload": c["payload"], "hashtags": c["hashtags"], "counters": c["counters"], "published_at": c["published_at"],
            "media": [{"kind": m["kind"], "url": signed_url(m["key"]), "width": m["w"], "height": m["h"], "alt": m["alt"]} for m in c["media"]]}


def _visible(request, post_id) -> Post:
    return get_or_404(SS.visible_posts(_vid(request)).filter(pk=post_id).select_related("author__profile", "group").prefetch_related("media"))


@endpoint("Publier. media : [{file, alt}] avec des fichiers envoyes (usage 'post_media'). poll : {question, options:[2 a 10], allows_multiple?, is_anonymous?, closes_at?}. audience : pseudos (visibilite 'custom').", status=201,
          body={"kind": s.ChoiceField(choices=[c[0] for c in Post.Kind.choices], default="text"), "title": s.CharField(max_length=200, required=False, allow_blank=True, default=""),
                "body": s.CharField(max_length=20000, required=False, allow_blank=True, default=""), "visibility": s.ChoiceField(choices=VIS, required=False), "group": s.SlugField(required=False),
                "payload": s.DictField(required=False), "media": s.ListField(child=s.DictField(), max_length=10, required=False), "audience": s.ListField(child=s.CharField(max_length=30), max_length=200, required=False),
                "poll": _PollIn(required=False)})
def create_post(request):
    d, u = request.input, request.user
    group = get_or_404(Group.objects.filter(slug=d["group"], archived_at__isnull=True)) if d.get("group") else None
    media = []
    for item in d.get("media", []):
        f = resolve_owned(u, item.get("file"), ("post_media",))
        media.append({"kind": f.content_type.split("/")[0] if f.content_type.split("/")[0] in ("image", "video", "audio") else "file", "storage_key": f.key, "mime_type": f.content_type,
                      "size_bytes": f.size_bytes, "alt_text": str(item.get("alt", ""))[:300]})
    post = SV.create_post(author=u, kind=d["kind"], body=d["body"], title=d["title"], visibility=d.get("visibility"), group=group, payload=d.get("payload"), media=media,
                          audience_user_ids=[_u(n).pk for n in d.get("audience", [])], poll=d.get("poll"))
    return _post(Post.objects.select_related("author__profile", "group").prefetch_related("media").get(pk=post.pk), u.pk)


@endpoint("Lire une publication (404 si je n'ai pas le droit de la voir).", auth="optional")
def get_post(request, post_id):
    return _post(_visible(request, post_id), _vid(request))


@endpoint("Modifier ma publication.", body={"title": s.CharField(max_length=200, required=False, allow_blank=True), "body": s.CharField(max_length=20000, required=False, allow_blank=True), "payload": s.DictField(required=False)})
def edit_post(request, post_id):
    SV.edit_post(post_id, request.user, **request.input)
    return _post(_visible(request, post_id), request.user.pk)


@endpoint("Supprimer ma publication (ou en moderateur de groupe).", status=204)
def delete_post(request, post_id):
    SV.delete_post(post_id, request.user)
    return Response(status=204)


@endpoint("Publications d'un utilisateur (seulement celles que je peux voir).", auth="optional")
def user_posts(request, username):
    owner = _u(username)
    qs = SS.visible_posts(_vid(request)).filter(author=owner).select_related("author__profile", "group").prefetch_related("media")
    return paginate(request, qs, ("-published_at", "-id"), lambda p: _post(p, _vid(request)), 20)


@endpoint("Mon fil d'actualite. 'before' : curseur renvoye par la page precedente (next_cursor).", query={"limit": s.IntegerField(min_value=1, max_value=50, default=20), "before": s.FloatField(required=False)})
def feed(request):
    page = FD.get_feed(request.user.pk, request.q["limit"], request.q.get("before"))
    cards = [_card(c) for c in page.posts]
    ids, uid = [c["id"] for c in cards], request.user.pk
    # Etat propre au lecteur (jamais stocke dans la carte partagee) : ma reaction, enregistre, sondages, nom du groupe.
    reactions = {str(k): v for k, v in PostReaction.objects.filter(post_id__in=ids, user_id=uid).values_list("post_id", "type")}
    saves = {str(k) for k in Save.objects.filter(post_id__in=ids, user_id=uid).values_list("post_id", flat=True)}
    polls = _polls([c["id"] for c in cards if c["kind"] == Post.Kind.POLL], uid)
    group_ids = {c.get("group_id") for c in page.posts if c.get("group_id")}
    groups = {str(pk): (slug, name) for pk, slug, name in Group.objects.filter(pk__in=group_ids).values_list("pk", "slug", "name")} if group_ids else {}
    for card, raw in zip(cards, page.posts):
        slug, name = groups.get(str(raw.get("group_id")), (None, None))
        card.update({"my_reaction": reactions.get(card["id"]), "saved": card["id"] in saves, "poll": polls.get(card["id"]), "group": slug, "group_name": name})
    return {"results": cards, "next_cursor": page.next_cursor}


@endpoint("Reagir a une publication (type = null pour retirer).", body={"type": s.CharField(allow_null=True, max_length=12)})
def react_post(request, post_id):
    _visible(request, post_id)
    r = SV.react_to_post(post_id, request.user, request.input["type"])
    return {"reaction": None if r is None else r.type}


@endpoint("Commentaires d'une publication (racines).", auth="optional")
def comments(request, post_id):
    _visible(request, post_id)
    qs = Comment.objects.filter(post_id=post_id, parent__isnull=True, deleted_at__isnull=True).select_related("author__profile")
    return _with_my_reactions(paginate(request, qs, ("-created_at", "-id"), _comment, 20), _vid(request))


def _comment(c: Comment) -> dict:
    return {"id": str(c.pk), "author": user_brief(c.author), "body": c.body, "parent": str(c.parent_id) if c.parent_id else None, "depth": c.depth, "reactions": c.reaction_count, "replies": c.reply_count, "created_at": c.created_at}


def _with_my_reactions(response, viewer_id):
    """Ajoute « my_reaction » a chaque commentaire d'une page (une requete pour toute la page)."""
    rows = response.data["results"]
    mine = {}
    if viewer_id and rows:
        mine = {str(cid): t for cid, t in CommentReaction.objects.filter(comment_id__in=[r["id"] for r in rows], user_id=viewer_id).values_list("comment_id", "type")}
    for r in rows:
        r["my_reaction"] = mine.get(r["id"])
    return response


@endpoint("Commenter (parent = identifiant d'un commentaire pour repondre).", status=201, body={"body": s.CharField(max_length=5000), "parent": s.UUIDField(required=False)})
def add_comment(request, post_id):
    _visible(request, post_id)
    return _comment(SV.add_comment(post_id, request.user, request.input["body"], request.input.get("parent")))


@endpoint("Reponses a un commentaire.", auth="optional")
def replies(request, comment_id):
    parent = get_or_404(Comment.objects.filter(pk=comment_id, deleted_at__isnull=True))
    _visible(request, parent.post_id)
    return _with_my_reactions(paginate(request, Comment.objects.filter(parent=parent, deleted_at__isnull=True).select_related("author__profile"), ("created_at", "id"), _comment, 20), _vid(request))


@endpoint("Supprimer un commentaire (auteur, auteur du post ou moderateur de groupe).", status=204)
def delete_comment(request, comment_id):
    SV.delete_comment(comment_id, request.user)
    return Response(status=204)


@endpoint("Reagir a un commentaire.", body={"type": s.CharField(allow_null=True, max_length=12)})
def react_comment(request, comment_id):
    c = get_or_404(Comment.objects.filter(pk=comment_id, deleted_at__isnull=True))
    _visible(request, c.post_id)
    SV.react_to_comment(comment_id, request.user, request.input["type"])
    return {"ok": True}


@endpoint("Partager une publication.", status=201, body={"comment": s.CharField(max_length=500, required=False, allow_blank=True, default=""), "visibility": s.ChoiceField(choices=VIS, default="public")})
def share(request, post_id):
    _visible(request, post_id)
    sh = SV.share_post(post_id, request.user, request.input["comment"], request.input["visibility"])
    return {"id": str(sh.pk)}


@endpoint("Enregistrer une publication dans mes favoris.", status=201, body={"collection": s.CharField(max_length=60, required=False, allow_blank=True, default="")})
def save(request, post_id):
    _visible(request, post_id)
    SV.save_post(post_id, request.user, request.input["collection"])
    return {"saved": True}


@endpoint("Retirer une publication de mes favoris.", status=204)
def unsave(request, post_id):
    SV.unsave_post(post_id, request.user)
    return Response(status=204)


@endpoint("Mes publications enregistrees.")
def saved(request):
    qs = Save.objects.filter(user=request.user).select_related("post__author__profile", "post__group")
    visible = set(SS.visible_posts(request.user.pk).filter(pk__in=[x.post_id for x in qs[:200]]).values_list("pk", flat=True))  # un favori devenu invisible disparait
    return paginate(request, qs.filter(post_id__in=visible), ("-created_at", "-id"), lambda x: _post(x.post, request.user.pk), 20)


@endpoint("Compter une vue (dedoublonne, au plus une par heure et par utilisateur).", auth="optional", status=202)
def view_post(request, post_id):
    _visible(request, post_id)
    return {"counted": SV.record_view(post_id, _vid(request))}


@endpoint("Voter dans un sondage (options : identifiants d'options).", body={"options": s.ListField(child=s.UUIDField(), min_length=1, max_length=10)})
def vote(request, post_id):
    _visible(request, post_id)
    SV.vote_poll(post_id, request.user, request.input["options"])
    return {"voted": True}


# ------------------------------------------------------------------ statuts ephemeres (24 h)
def _status(st: Status, viewed: bool = False) -> dict:
    return {"id": str(st.pk), "author": user_brief(st.author), "kind": st.kind, "body": st.body, "media_url": signed_url(st.storage_key) if st.storage_key else None, "mime_type": st.mime_type,
            "link_url": st.link_url, "style": st.style, "visibility": st.visibility, "expires_at": st.expires_at, "created_at": st.created_at, "viewed": viewed}


@endpoint("Publier un statut ephemere (24 h). file : fichier envoye (usage 'status_media').", status=201,
          body={"kind": s.ChoiceField(choices=[c[0] for c in Status.Kind.choices], default="text"), "body": s.CharField(max_length=500, required=False, allow_blank=True, default=""),
                "visibility": s.ChoiceField(choices=VIS, required=False), "file": s.UUIDField(required=False), "link_url": s.URLField(required=False), "style": s.DictField(required=False),
                "audience": s.ListField(child=s.CharField(max_length=30), max_length=200, required=False)})
def create_status(request):
    d = request.input
    f = resolve_owned(request.user, d["file"], ("status_media",)) if d.get("file") else None
    st = SV.create_status(author=request.user, kind=d["kind"], body=d["body"], visibility=d.get("visibility"), storage_key=f.key if f else "", mime_type=f.content_type if f else "",
                          link_url=d.get("link_url", ""), style=d.get("style"), audience_user_ids=[_u(n).pk for n in d.get("audience", [])])
    return _status(Status.objects.select_related("author__profile").get(pk=st.pk))


@endpoint("Statuts actifs que je peux voir.")
def statuses(request):
    items = list(SS.active_statuses_for(request.user.pk).select_related("author__profile")[:200])
    seen = set(StatusView.objects.filter(viewer=request.user, status_id__in=[st.pk for st in items]).values_list("status_id", flat=True))
    return [_status(st, viewed=st.pk in seen or st.author_id == request.user.pk) for st in items]


@endpoint("Marquer un statut comme vu.", status=202)
def view_status(request, status_id):
    get_or_404(SS.active_statuses_for(request.user.pk).filter(pk=status_id))
    return {"counted": SV.view_status(status_id, request.user)}


@endpoint("Reagir a un statut.", status=201, body={"emoji": s.CharField(max_length=16)})
def react_status(request, status_id):
    get_or_404(SS.active_statuses_for(request.user.pk).filter(pk=status_id))
    SV.react_to_status(status_id, request.user, request.input["emoji"])
    return {"ok": True}


# ------------------------------------------------------------------ hashtags
@endpoint("Hashtags tendance (vue materialisee).", auth="public")
def trending(request):
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM mv_trending_hashtags LIMIT 20")
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


@endpoint("Publications d'un hashtag (seulement celles que je peux voir).", auth="optional")
def hashtag_posts(request, tag):
    qs = SS.visible_posts(_vid(request)).filter(post_hashtags__hashtag__tag=tag.lower().lstrip("#")).select_related("author__profile", "group").prefetch_related("media")
    return paginate(request, qs, ("-published_at", "-id"), lambda p: _post(p, _vid(request)), 20)
