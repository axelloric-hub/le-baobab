"""Groupes, communautes, channels. Les groupes caches n'existent pas pour les non-membres (404)."""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from rest_framework import serializers as s
from rest_framework.response import Response

from apps.community import selectors as CS
from apps.community import services as CV
from apps.community.models import Channel, Community, Group, GroupInvitation, GroupJoinRequest, GroupMember
from apps.core.api import endpoint, get_or_404, paginate
from apps.core.exceptions import PermissionDeniedError
from apps.profiles.render import file_url, user_brief
from apps.profiles.selectors import get_active_or_404 as _u


def _group(request, slug, *, need_visible=True) -> Group:
    g = get_or_404(Group.objects.filter(slug=slug, archived_at__isnull=True))
    uid = getattr(request.user, "pk", None)
    if g.privacy == "hidden" and not (uid and CS.get_membership(uid, g.pk)):
        get_or_404(Group.objects.none())
    return g


def _json(g: Group, viewer) -> dict:
    uid = getattr(viewer, "pk", None)
    m = CS.get_membership(uid, g.pk) if uid else None
    return {"slug": g.slug, "name": g.name, "description": g.description, "privacy": g.privacy, "join_policy": g.join_policy, "member_count": g.member_count,
            "avatar_url": file_url(g.avatar_key), "cover_url": file_url(g.cover_key), "community": g.community.slug if g.community_id else None,
            "my_role": m.role.name if m else None,
            "my_request_pending": bool(uid) and not m and GroupJoinRequest.objects.filter(group=g, user_id=uid, status="pending").exists()}


@endpoint("Decouvrir les groupes (publics et prives ; jamais les caches).", auth="optional", query={"q": s.CharField(required=False, max_length=60), "community": s.SlugField(required=False)})
def list_groups(request):
    qs = Group.objects.filter(archived_at__isnull=True).exclude(privacy="hidden")
    if request.q.get("q"):
        qs = qs.filter(name__icontains=request.q["q"])
    if request.q.get("community"):
        qs = qs.filter(community__slug=request.q["community"])
    return paginate(request, qs.select_related("community"), ("-created_at", "-id"), lambda g: _json(g, request.user), 20)


@endpoint("Mes groupes.")
def my_groups(request):
    qs = Group.objects.filter(memberships__user=request.user, archived_at__isnull=True).select_related("community")
    return paginate(request, qs, ("-created_at", "-id"), lambda g: _json(g, request.user), 50)


@endpoint("Creer un groupe (vous en devenez proprietaire).", status=201,
          body={"name": s.CharField(max_length=120), "slug": s.SlugField(max_length=80), "description": s.CharField(max_length=3000, required=False, allow_blank=True),
                "privacy": s.ChoiceField(choices=[c[0] for c in Group.Privacy.choices], default="public"), "join_policy": s.ChoiceField(choices=[c[0] for c in Group.JoinPolicy.choices], default="open"),
                "community": s.SlugField(required=False)})
def create_group(request):
    d = request.input
    community = get_or_404(Community.objects.filter(slug=d["community"])) if d.get("community") else None
    g = CV.create_group(owner=request.user, name=d["name"], slug=d["slug"], community=community, privacy=d["privacy"], join_policy=d["join_policy"], description=d.get("description", ""))
    return _json(g, request.user)


@endpoint("Detail d'un groupe.", auth="optional")
def group_detail(request, slug):
    return _json(_group(request, slug), request.user)


@endpoint("Rejoindre un groupe : adhesion immediate, ou demande en attente selon la politique du groupe.", status=201)
def join(request, slug):
    r = CV.join_group(request.user, _group(request, slug))
    return {"status": "pending" if isinstance(r, GroupJoinRequest) else "joined"}


@endpoint("Quitter un groupe.", status=204)
def leave(request, slug):
    CV.leave_group(request.user, _group(request, slug))
    return Response(status=204)


@endpoint("Membres d'un groupe (public : tout le monde ; sinon membres uniquement).", auth="optional")
def members(request, slug):
    g = _group(request, slug)
    if not CS.can_view_group_content(getattr(request.user, "pk", None), g):
        get_or_404(Group.objects.none())
    qs = GroupMember.objects.filter(group=g).select_related("user__profile", "role")
    return paginate(request, qs, ("-joined_at", "-id"), lambda m: {**user_brief(m.user), "role": m.role.name, "joined_at": m.joined_at}, 50)


@endpoint("Inviter un utilisateur dans le groupe (permission 'member.invite').", status=201, body={"username": s.CharField(max_length=30)})
def invite(request, slug):
    inv = CV.invite_user(_group(request, slug), request.user, _u(request.input["username"]))
    return {"id": str(inv.pk), "status": inv.status}


@endpoint("Mes invitations de groupe en attente.")
def my_invitations(request):
    qs = GroupInvitation.objects.filter(invited_user=request.user, status="pending").select_related("group", "invited_by__profile")
    return [{"id": str(i.pk), "group": {"slug": i.group.slug, "name": i.group.name}, "invited_by": user_brief(i.invited_by), "expires_at": i.expires_at} for i in qs[:100]]


@endpoint("Accepter ou refuser une invitation de groupe.", body={"accept": s.BooleanField()})
def respond_invitation(request, invitation_id):
    inv = CV.respond_to_invitation(invitation_id, request.user, request.input["accept"])
    return {"id": str(inv.pk), "status": inv.status}


@endpoint("Demandes d'adhesion en attente (reservees a ceux qui peuvent les approuver).")
def join_requests(request, slug):
    g = _group(request, slug)
    if not CS.can(request.user.pk, g.pk, "member.approve"):
        raise PermissionDeniedError("Permission 'member.approve' requise.")
    qs = GroupJoinRequest.objects.filter(group=g, status="pending").select_related("user__profile")
    return [{"id": str(r.pk), "user": user_brief(r.user), "message": r.message, "created_at": r.created_at} for r in qs[:100]]


@endpoint("Approuver ou refuser une demande d'adhesion.", body={"approve": s.BooleanField()})
def review_request(request, request_id):
    r = CV.review_join_request(request_id, request.user, request.input["approve"])
    return {"id": str(r.pk), "status": r.status}


@endpoint("Bannir un membre (permission 'member.ban').", status=201, body={"username": s.CharField(max_length=30), "reason": s.CharField(max_length=300, required=False, allow_blank=True),
                                                                          "expires_at": s.DateTimeField(required=False)})
def ban(request, slug):
    d = request.input
    CV.ban_member(_group(request, slug), request.user, _u(d["username"]), d.get("reason", ""), d.get("expires_at"))
    return {"banned": True}


@endpoint("Rendre muet un membre (permission 'member.mute').", status=201, body={"username": s.CharField(max_length=30), "minutes": s.IntegerField(min_value=1, max_value=43200), "reason": s.CharField(max_length=300, required=False, allow_blank=True)})
def mute_member(request, slug):
    d = request.input
    CV.mute_member(_group(request, slug), request.user, _u(d["username"]), timedelta(minutes=d["minutes"]), d.get("reason", ""))
    return {"muted": True}


@endpoint("Channels d'un groupe (membres uniquement).")
def channels(request, slug):
    g = _group(request, slug)
    if not CS.get_membership(request.user.pk, g.pk):
        get_or_404(Group.objects.none())
    return [{"slug": c.slug, "name": c.name, "type": c.type, "topic": c.topic} for c in Channel.objects.filter(group=g, archived_at__isnull=True)]


@endpoint("Creer un channel dans un groupe (permission 'channel.manage').", status=201,
          body={"name": s.CharField(max_length=100), "slug": s.SlugField(max_length=80), "type": s.ChoiceField(choices=[c[0] for c in Channel.Type.choices], default="discussion"), "topic": s.CharField(max_length=300, required=False, allow_blank=True)})
def create_channel(request, slug):
    d = request.input
    c = CV.create_channel(_group(request, slug), request.user, name=d["name"], slug=d["slug"], type=d["type"], topic=d.get("topic", ""))
    return {"slug": c.slug, "name": c.name, "type": c.type}


@endpoint("Communautes publiques.", auth="public")
def communities(request):
    return [{"slug": c.slug, "name": c.name, "description": c.description} for c in Community.objects.filter(archived_at__isnull=True, privacy="public")[:100]]


@endpoint("Creer une communaute.", status=201, body={"name": s.CharField(max_length=120), "slug": s.SlugField(max_length=80), "description": s.CharField(max_length=3000, required=False, allow_blank=True)})
def create_community(request):
    d = request.input
    c = CV.create_community(request.user, name=d["name"], slug=d["slug"], description=d.get("description", ""))
    return {"slug": c.slug, "name": c.name}
