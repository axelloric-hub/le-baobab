"""Profil : moi, profils publics (confidentialite respectee), recherche, referentiels."""
from __future__ import annotations

from django.db import connection
from rest_framework import serializers as s
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.accounts.services import anonymize_user
from apps.core.api import endpoint, get_or_404, paginate
from apps.core.exceptions import PermissionDeniedError
from apps.friends import selectors as FS
from apps.friends.models import Follow
from apps.profiles import selectors as PS
from apps.profiles import services as P
from apps.profiles.models import Country, Interest, Profession, Skill, SocialLink
from apps.profiles.render import profile_full, user_brief
from apps.storage.services import resolve_owned

VIS = ["public", "followers", "friends", "close_friends", "private"]
AVAILABILITY = ["none", "open_to_work", "freelance", "hiring"]


def _me(u) -> dict:
    u = type(u).objects.select_related("profile", "privacy", "preferences").get(pk=u.pk)
    pr, pv, pf = u.privacy, u.privacy, u.preferences
    return {**profile_full(u, private=True), "email_verified": u.email_verified_at is not None,
            "privacy": {k: getattr(pr, k) for k in ("profile_visibility", "portfolio_visibility", "default_post_visibility", "default_status_visibility", "activity_visibility",
                                                    "who_can_message", "who_can_send_friend_request", "show_presence", "show_read_receipts", "searchable")},
            "preferences": {"language": pf.language, "time_zone": pf.time_zone, "theme": pf.theme}}


@endpoint("Mon compte complet : identite, profil, confidentialite, preferences.")
def me(request):
    return _me(request.user)


@endpoint("Modifier mon profil (champs facultatifs). avatar_file / cover_file : identifiant d'un fichier envoye (usage 'avatar' / 'cover'), ou null pour effacer.",
          body={"display_name": s.CharField(max_length=80, required=False), "headline": s.CharField(max_length=160, required=False, allow_blank=True),
                "bio": s.CharField(max_length=2000, required=False, allow_blank=True), "country": s.CharField(max_length=2, required=False, allow_null=True),
                "region": s.CharField(max_length=80, required=False, allow_blank=True), "city": s.CharField(max_length=80, required=False, allow_blank=True),
                "languages": s.ListField(child=s.CharField(max_length=8), max_length=10, required=False), "profession": s.CharField(max_length=80, required=False, allow_null=True),
                "availability": s.ChoiceField(choices=AVAILABILITY, required=False), "avatar_file": s.UUIDField(required=False, allow_null=True),
                "cover_file": s.UUIDField(required=False, allow_null=True)})
def update_profile(request):
    d, u = request.input, request.user
    def file_arg(name, purpose):
        if name not in d:
            return ...
        return None if d[name] is None else resolve_owned(u, d[name], (purpose,))
    P.update_profile(u, fields=d, avatar=file_arg("avatar_file", "avatar"), cover=file_arg("cover_file", "cover"),
                     country_code=d["country"] if "country" in d else ..., profession_slug=d["profession"] if "profession" in d else ...)
    return _me(u)


@endpoint("Ma confidentialite.", body={"profile_visibility": s.ChoiceField(choices=VIS, required=False), "portfolio_visibility": s.ChoiceField(choices=VIS, required=False),
                                      "default_post_visibility": s.ChoiceField(choices=VIS + ["group_members"], required=False), "default_status_visibility": s.ChoiceField(choices=VIS, required=False),
                                      "activity_visibility": s.ChoiceField(choices=VIS, required=False), "who_can_message": s.ChoiceField(choices=["everyone", "friends", "nobody"], required=False),
                                      "who_can_send_friend_request": s.ChoiceField(choices=["everyone", "friends", "nobody"], required=False), "show_presence": s.BooleanField(required=False),
                                      "show_read_receipts": s.BooleanField(required=False), "searchable": s.BooleanField(required=False)})
def update_privacy(request):
    if request.input:
        P.update_privacy(request.user, **request.input)
    return _me(request.user)["privacy"]


@endpoint("Mes preferences (langue, fuseau, theme).", body={"language": s.CharField(max_length=8, required=False), "time_zone": s.CharField(max_length=64, required=False),
                                                         "theme": s.ChoiceField(choices=["system", "light", "dark"], required=False)})
def update_preferences(request):
    if request.input:
        P.update_preferences(request.user, **request.input)
    return _me(request.user)["preferences"]


@endpoint("Remplacer la liste de mes competences.", body={"skills": s.ListField(max_length=60, child=s.DictField())})
def replace_skills(request):
    items = []
    for raw in request.input["skills"]:
        items.append(_SkillItem(data=raw).validated())
    P.replace_skills(request.user, items)
    return _me(request.user)["skills"]


class _SkillItem(s.Serializer):
    slug = s.CharField(max_length=80)
    level = s.IntegerField(min_value=1, max_value=5)
    years_experience = s.DecimalField(max_digits=4, decimal_places=1, min_value=0, required=False)

    def validated(self):
        self.is_valid(raise_exception=True)
        return {**self.validated_data, **({"years_experience": float(self.validated_data["years_experience"])} if "years_experience" in self.validated_data else {})}


@endpoint("Remplacer la liste de mes centres d'interet.", body={"interests": s.ListField(child=s.CharField(max_length=80), max_length=40)})
def replace_interests(request):
    P.replace_interests(request.user, request.input["interests"])
    return _me(request.user)["interests"]


@endpoint("Ajouter un lien (GitHub, LinkedIn, site...). https obligatoire.", status=201,
          body={"provider": s.ChoiceField(choices=[c[0] for c in SocialLink.Provider.choices]), "url": s.URLField(max_length=300), "handle": s.CharField(max_length=100, required=False, allow_blank=True)})
def add_link(request):
    d = request.input
    if not d["url"].startswith("https://"):
        raise s.ValidationError({"url": "Le lien doit commencer par https://"})
    l = P.add_social_link(request.user, provider=d["provider"], url=d["url"], handle=d.get("handle", ""))
    return {"id": str(l.pk), "provider": l.provider, "url": l.url}


@endpoint("Supprimer un de mes liens.", status=204)
def delete_link(request, link_id):
    get_or_404(SocialLink.objects.filter(pk=link_id, user=request.user)).delete()
    return Response(status=204)


@endpoint("Supprimer mon compte (anonymisation irreversible). Exige le mot de passe.", body={"password": s.CharField(trim_whitespace=False, max_length=128)}, status=204)
def delete_account(request):
    if not request.user.check_password(request.input["password"]):
        raise PermissionDeniedError("Mot de passe incorrect.", code="invalid_credentials")
    anonymize_user(user=request.user)
    return Response(status=204)


@endpoint("Profil public d'un utilisateur (404 si prive, bloque ou inexistant).", auth="optional")
def user_profile(request, username):
    owner = PS.active_user(username)
    if owner is None or not PS.can_view_profile(request.user, owner):
        raise NotFound()  # inexistant, prive ou bloque : meme reponse (on ne revele rien)
    out = profile_full(owner)
    with connection.cursor() as cur:
        cur.execute("SELECT post_count, follower_count, following_count, friend_count FROM baobab_user_stats(%s)", [owner.pk])
        out["stats"] = dict(zip(("posts", "followers", "following", "friends"), cur.fetchone()))
    if request.user.is_authenticated and request.user.pk != owner.pk:
        out["relation"] = {"is_friend": FS.are_friends(request.user.pk, owner.pk), "is_following": Follow.objects.filter(follower=request.user, followee=owner).exists()}
    return out


@endpoint("Rechercher des utilisateurs par nom ou pseudo (profils 'recherchables' uniquement, minimum 2 caracteres).", auth="optional", query={"q": s.CharField(min_length=2, max_length=60)})
def search_users(request):
    from django.db.models import Q

    from apps.profiles.models import Profile

    q = request.q["q"]
    qs = Profile.objects.filter(user__status="active", user__privacy__searchable=True).filter(Q(display_name__icontains=q) | Q(user__username__startswith=q.lower())).select_related("user")
    if request.user.is_authenticated:
        qs = qs.exclude(user__in=FS.users_hidden_from(request.user.pk))
    return [user_brief(p.user) for p in qs.order_by("display_name")[:20]]


def _ref(model, **extra):
    @endpoint(f"Referentiel : {model.__name__}.", auth="public", query={"q": s.CharField(required=False, max_length=60)})
    def listing(request):
        qs = model.objects.all()
        if request.q.get("q") and hasattr(model, "name"):
            qs = qs.filter(name__icontains=request.q["q"])
        if hasattr(model, "is_active"):
            qs = qs.filter(is_active=True)
        return [{"slug": getattr(o, "slug", None) or o.code, "name": o.name, **({"region": o.region, "is_african": o.is_african} if model is Country else {})} for o in qs[:200]]
    listing.__name__ = f"list_{model.__name__.lower()}"
    return listing


list_skills, list_interests, list_professions, list_countries = _ref(Skill), _ref(Interest), _ref(Profession), _ref(Country)
