"""Amis, abonnements, blocages. Toute action vise un pseudo ; un pseudo inconnu ou inactif donne 404."""
from __future__ import annotations

from rest_framework import serializers as s
from rest_framework.response import Response

from apps.accounts.models import User
from apps.core.api import endpoint, get_or_404, paginate
from apps.friends import selectors as FS
from apps.friends import services as FV
from apps.friends.models import Block, Follow, Friendship
from apps.profiles.render import user_brief
from apps.profiles.selectors import get_active_or_404 as _u

UN = lambda: s.CharField(max_length=30)  # noqa: E731


@endpoint("Envoyer une demande d'ami (si l'autre vous en avait deja envoye une, l'amitie est creee).", status=201, body={"username": UN()})
def send_request(request):
    f = FV.send_friend_request(request.user, _u(request.input["username"]))
    return {"id": str(f.pk), "status": f.status}


@endpoint("Demandes d'amis recues, en attente.")
def incoming_requests(request):
    return [{"id": str(f.pk), "from": user_brief(f.requested_by), "created_at": f.created_at} for f in FS.pending_requests_for(request.user.pk)[:100]]


@endpoint("Demandes d'amis envoyees, en attente.")
def sent_requests(request):
    qs = Friendship.objects.filter(status="pending", requested_by=request.user).order_by("-created_at")[:100]
    out = []
    for f in qs:
        other = f.user_high if f.user_low_id == request.user.pk else f.user_low
        out.append({"id": str(f.pk), "to": user_brief(other), "created_at": f.created_at})
    return out


@endpoint("Accepter ou refuser une demande d'ami recue.", body={"accept": s.BooleanField()})
def respond(request, request_id):
    f = FV.respond_to_request(request_id, request.user, request.input["accept"])
    return {"id": str(f.pk), "status": f.status}


@endpoint("Mes amis (ordre alphabetique des pseudos).")
def friends(request):
    return paginate(request, User.objects.filter(pk__in=FS.friend_ids(request.user.pk)).select_related("profile"), ("username",), user_brief, 50)


@endpoint("Retirer un ami.", status=204)
def remove_friend(request, username):
    FV.remove_friend(request.user, _u(username))
    return Response(status=204)


@endpoint("Suivre un utilisateur.", status=201)
def follow(request, username):
    FV.follow(request.user, _u(username))
    return {"following": True}


@endpoint("Ne plus suivre un utilisateur.", status=204)
def unfollow(request, username):
    FV.unfollow(request.user, _u(username))
    return Response(status=204)


@endpoint("Mes abonnes.")
def followers(request):
    qs = Follow.objects.filter(followee=request.user).select_related("follower__profile")
    return paginate(request, qs, ("-created_at", "-id"), lambda f: user_brief(f.follower), 50)


@endpoint("Les comptes que je suis.")
def following(request):
    qs = Follow.objects.filter(follower=request.user).select_related("followee__profile")
    return paginate(request, qs, ("-created_at", "-id"), lambda f: user_brief(f.followee), 50)


@endpoint("Bloquer un utilisateur (supprime amitie et abonnements dans les deux sens ; il ne vous voit plus).", status=201)
def block(request, username):
    FV.block_user(request.user, _u(username))
    return {"blocked": True}


@endpoint("Debloquer un utilisateur.", status=204)
def unblock(request, username):
    FV.unblock_user(request.user, User.objects.filter(username=username.lower()).first() or get_or_404(User.objects.none()))
    return Response(status=204)


@endpoint("Mes blocages.")
def blocks(request):
    return [user_brief(b.blocked) for b in Block.objects.filter(blocker=request.user).select_related("blocked__profile")[:200]]


@endpoint("Ajouter un ami a mes amis proches.", status=201)
def add_close(request, username):
    FV.add_close_friend(request.user, _u(username))
    return {"close_friend": True}


@endpoint("Retirer un ami de mes amis proches.", status=204)
def remove_close(request, username):
    from apps.friends.models import CloseFriend

    CloseFriend.objects.filter(owner=request.user, friend__username=username.lower()).delete()
    return Response(status=204)


@endpoint("Mettre un utilisateur en sourdine (ses contenus disparaissent de mon feed).", status=201, body={"scope": s.ChoiceField(choices=["all", "posts", "statuses", "messages"], default="all")})
def mute(request, username):
    FV.mute_user(request.user, _u(username), request.input["scope"])
    return {"muted": True}
