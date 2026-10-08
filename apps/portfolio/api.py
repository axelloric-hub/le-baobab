"""Portfolio : projets, depots (saisie manuelle : aucune API GitHub/GitLab), experiences, formations, realisations, certificats (verifiables si LE BAOBAB)."""
from __future__ import annotations

from rest_framework import serializers as s
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.api import endpoint, get_or_404
from apps.portfolio import services as P
from apps.portfolio.models import Portfolio, Project
from apps.portfolio.selectors import can_view_portfolio
from apps.profiles.models import Skill
from apps.profiles.render import user_brief
from apps.profiles.selectors import get_active_or_404 as _u
from apps.storage.services import resolve_owned, signed_url

VIS = ["public", "followers", "friends", "close_friends", "private"]


def _project(p: Project) -> dict:
    return {"id": str(p.pk), "slug": p.slug, "title": p.title, "description": p.description, "role": p.role, "started_on": p.started_on, "ended_on": p.ended_on, "is_featured": p.is_featured,
            "technologies": [t.slug for t in p.technologies.all()], "links": [{"kind": l.kind, "provider": l.provider, "url": l.url} for l in p.links.all()],
            "media": [{"kind": m.kind, "url": signed_url(m.storage_key)} for m in p.media.all()]}


def _full(owner) -> dict:
    pf = P.ensure_portfolio(owner)
    u = owner
    return {"owner": user_brief(u), "title": pf.title, "summary": pf.summary, "visibility": pf.visibility,
            "projects": [_project(p) for p in pf.projects.prefetch_related("technologies", "links", "media")],
            "repositories": [{"id": str(r.pk), "provider": r.provider, "full_name": r.full_name, "url": r.url, "description": r.description, "language": r.language, "stars": r.stars} for r in u.repositories.all()],
            "experiences": [{"id": str(e.pk), "company_name": e.company_name, "title": e.title, "location": e.location, "started_on": e.started_on, "ended_on": e.ended_on, "description": e.description} for e in u.experiences.order_by("-started_on")],
            "educations": [{"id": str(e.pk), "institution": e.institution, "degree": e.degree, "field": e.field, "started_on": e.started_on, "ended_on": e.ended_on} for e in u.educations.all()],
            "achievements": [{"id": str(a.pk), "title": a.title, "issuer": a.issuer, "achieved_on": a.achieved_on, "url": a.url} for a in u.achievements.all()],
            "certificates": [{"id": str(c.pk), "name": c.name, "issuer": c.issuer, "issued_on": c.issued_on, "credential_url": c.credential_url, "verified_by_platform": c.platform_certificate_ref is not None} for c in u.certificate_entries.all()]}


@endpoint("Mon portfolio complet.")
def my_portfolio(request):
    return _full(request.user)


@endpoint("Modifier mon portfolio (titre, resume, visibilite).", body={"title": s.CharField(max_length=140, required=False, allow_blank=True), "summary": s.CharField(max_length=3000, required=False, allow_blank=True), "visibility": s.ChoiceField(choices=VIS, required=False)})
def update_portfolio(request):
    P.update_portfolio(request.user, **request.input)
    return _full(request.user)


@endpoint("Portfolio d'un utilisateur (404 si prive pour moi).", auth="optional")
def user_portfolio(request, username):
    owner = _u(username)
    if not can_view_portfolio(request.user, owner.pk):
        raise NotFound()
    return _full(owner)


class _LinkIn(s.Serializer):
    kind = s.ChoiceField(choices=["demo", "repository", "article", "other"], default="other")
    provider = s.CharField(max_length=12, required=False, allow_blank=True, default="")
    url = s.URLField(max_length=400)


@endpoint("Ajouter un projet. technologies : slugs de competences.", status=201,
          body={"slug": s.SlugField(max_length=80), "title": s.CharField(max_length=160), "description": s.CharField(max_length=10000, required=False, allow_blank=True, default=""), "role": s.CharField(max_length=100, required=False, allow_blank=True, default=""),
                "started_on": s.DateField(required=False), "ended_on": s.DateField(required=False), "technologies": s.ListField(child=s.CharField(max_length=80), required=False, max_length=30), "links": s.ListField(child=_LinkIn(), required=False, max_length=10)})
def add_project(request):
    d = request.input
    techs = list(Skill.objects.filter(slug__in=d.get("technologies", [])))
    p = P.create_project(request.user, slug=d["slug"], title=d["title"], description=d["description"], role=d["role"], started_on=d.get("started_on"), ended_on=d.get("ended_on"), technologies=techs, links=[dict(l) for l in d.get("links", [])])
    return _project(p)


@endpoint("Ajouter un lien a un de mes projets.", status=201, body={"kind": s.ChoiceField(choices=["demo", "repository", "article", "other"], default="other"), "provider": s.CharField(max_length=12, required=False, allow_blank=True, default=""), "url": s.URLField(max_length=400)})
def add_link(request, project_id):
    l = P.add_project_link(request.user, project_id, **request.input)
    return {"id": str(l.pk)}


@endpoint("Ajouter une image/video a un de mes projets (fichier envoye, usage 'portfolio_media').", status=201, body={"file": s.UUIDField()})
def add_media(request, project_id):
    f = resolve_owned(request.user, request.input["file"], ("portfolio_media",))
    P.add_project_media(request.user, project_id, storage_key=f.key, kind=f.content_type.split("/")[0])
    return {"added": True}


@endpoint("Declarer un depot (saisie manuelle).", status=201, body={"provider": s.ChoiceField(choices=["github", "gitlab"]), "full_name": s.CharField(max_length=200), "url": s.URLField(max_length=400), "description": s.CharField(max_length=500, required=False, allow_blank=True), "language": s.CharField(max_length=40, required=False, allow_blank=True)})
def add_repository(request):
    d = dict(request.input)
    r = P.register_repository(request.user, provider=d.pop("provider"), full_name=d.pop("full_name"), url=d.pop("url"), **d)
    return {"id": str(r.pk)}


@endpoint("Ajouter une experience.", status=201, body={"company_name": s.CharField(max_length=140), "title": s.CharField(max_length=140), "location": s.CharField(max_length=100, required=False, allow_blank=True), "started_on": s.DateField(), "ended_on": s.DateField(required=False), "description": s.CharField(max_length=5000, required=False, allow_blank=True)})
def add_experience(request):
    return {"id": str(P.add_experience(request.user, **request.input).pk)}


@endpoint("Ajouter une formation.", status=201, body={"institution": s.CharField(max_length=160), "degree": s.CharField(max_length=140, required=False, allow_blank=True), "field": s.CharField(max_length=140, required=False, allow_blank=True), "started_on": s.DateField(required=False), "ended_on": s.DateField(required=False)})
def add_education(request):
    return {"id": str(P.add_education(request.user, **request.input).pk)}


@endpoint("Ajouter une realisation.", status=201, body={"title": s.CharField(max_length=160), "issuer": s.CharField(max_length=140, required=False, allow_blank=True), "achieved_on": s.DateField(required=False), "url": s.URLField(required=False, allow_blank=True)})
def add_achievement(request):
    return {"id": str(P.add_achievement(request.user, **request.input).pk)}


@endpoint("Afficher un de MES certificats LE BAOBAB (verifiable publiquement).", status=201, body={"certificate_id": s.UUIDField()})
def add_certificate(request):
    return {"id": str(P.add_platform_certificate(request.user, request.input["certificate_id"]).pk)}


@endpoint("Supprimer une entree de mon portfolio. kind : projects, experiences, educations, achievements, certificates, repositories.", status=204)
def delete_entry(request, kind, entry_id):
    P.delete_entry(request.user, kind, entry_id)
    return Response(status=204)
