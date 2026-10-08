from __future__ import annotations

from rest_framework import serializers as s
from rest_framework.response import Response

from apps.companies import services as C
from apps.companies.models import Company, CompanyMember, CompanyProject, CompanyService, CompanySocialLink, CompanyVerification
from apps.core.api import endpoint, get_or_404, paginate
from apps.core.exceptions import PermissionDeniedError
from apps.profiles.render import file_url, user_brief
from apps.profiles.selectors import get_active_or_404 as _u
from apps.storage.services import resolve_owned


def _co(slug) -> Company:
    c = get_or_404(Company.objects.filter(slug=slug).select_related("country"))
    if c.status == "suspended":
        get_or_404(Company.objects.none())
    return c


def _json(c: Company) -> dict:
    return {"slug": c.slug, "name": c.name, "tagline": c.tagline, "description": c.description, "website": c.website, "industry": c.industry, "size_range": c.size_range, "city": c.city,
            "country": c.country_id, "logo_url": file_url(c.logo_key), "cover_url": file_url(c.cover_key), "verified": c.status == "verified",
            "links": [{"provider": l.provider, "url": l.url} for l in c.social_links.all()],
            "projects": [{"title": p.title, "description": p.description, "url": p.url, "repo_url": p.repo_url} for p in c.projects.filter(is_public=True)],
            "services": [{"title": x.title, "description": x.description, "starting_price_minor": x.starting_price_minor, "currency": x.currency} for x in c.services.filter(is_active=True)]}


@endpoint("Creer une entreprise (vous en etes le proprietaire).", status=201, body={"name": s.CharField(max_length=140), "slug": s.SlugField(max_length=80), "tagline": s.CharField(max_length=200, required=False, allow_blank=True),
                                                                                    "description": s.CharField(max_length=10000, required=False, allow_blank=True), "website": s.URLField(required=False, allow_blank=True),
                                                                                    "industry": s.CharField(max_length=80, required=False, allow_blank=True), "size_range": s.ChoiceField(choices=["", "1-10", "11-50", "51-200", "201-1000", "1000+"], required=False),
                                                                                    "city": s.CharField(max_length=80, required=False, allow_blank=True)})
def create(request):
    d = dict(request.input)
    return _json(C.create_company(request.user, name=d.pop("name"), slug=d.pop("slug"), **d))


@endpoint("Mes entreprises.")
def mine(request):
    return [{"slug": m.company.slug, "name": m.company.name, "role": m.role} for m in CompanyMember.objects.filter(user=request.user).select_related("company")]


@endpoint("Page publique d'une entreprise.", auth="public")
def detail(request, slug):
    return _json(_co(slug))


@endpoint("[Gestionnaire/editeur] Modifier l'entreprise. logo_file / cover_file : fichiers envoyes (usages 'company_logo' / 'company_cover').",
          body={"name": s.CharField(max_length=140, required=False), "tagline": s.CharField(max_length=200, required=False, allow_blank=True), "description": s.CharField(max_length=10000, required=False, allow_blank=True),
                "website": s.URLField(required=False, allow_blank=True), "industry": s.CharField(max_length=80, required=False, allow_blank=True), "size_range": s.ChoiceField(choices=["", "1-10", "11-50", "51-200", "201-1000", "1000+"], required=False),
                "city": s.CharField(max_length=80, required=False, allow_blank=True), "country": s.CharField(max_length=2, required=False, allow_null=True), "logo_file": s.UUIDField(required=False, allow_null=True), "cover_file": s.UUIDField(required=False, allow_null=True)})
def update(request, slug):
    d, c = dict(request.input), _co(slug)
    logo = ... if "logo_file" not in d else ("" if d["logo_file"] is None else resolve_owned(request.user, d["logo_file"], ("company_logo",)).key)
    cover = ... if "cover_file" not in d else ("" if d["cover_file"] is None else resolve_owned(request.user, d["cover_file"], ("company_cover",)).key)
    return _json(C.update_company(c, request.user, fields=d, logo_key=logo, cover_key=cover))


@endpoint("Equipe visible sur la page publique.", auth="public")
def members(request, slug):
    c = _co(slug)
    return [{**user_brief(m.user), "title": m.title, "role": m.role} for m in CompanyMember.objects.filter(company=c, is_public=True).select_related("user__profile")]


@endpoint("[Gestionnaire] Ajouter un membre (role : admin, recruiter, editor, employee).", status=201, body={"username": s.CharField(max_length=30), "role": s.ChoiceField(choices=["owner", "admin", "recruiter", "editor", "employee"], default="employee"), "title": s.CharField(max_length=100, required=False, allow_blank=True, default="")})
def add_member(request, slug):
    d = request.input
    m = C.add_member(_co(slug), request.user, _u(d["username"]), d["role"], d["title"])
    return {"id": str(m.pk), "role": m.role}


@endpoint("[Gestionnaire] Changer le role d'un membre.", body={"role": s.ChoiceField(choices=["owner", "admin", "recruiter", "editor", "employee"])})
def change_role(request, slug, username):
    m = C.change_role(_co(slug), request.user, _u(username), request.input["role"])
    return {"role": m.role}


@endpoint("Retirer un membre (ou quitter l'entreprise). Le dernier proprietaire ne peut pas partir.", status=204)
def remove_member(request, slug, username):
    C.remove_member(_co(slug), request.user, _u(username))
    return Response(status=204)


@endpoint("[Gestionnaire] Demander la verification de l'entreprise.", status=201, body={"method": s.ChoiceField(choices=["domain_email", "document", "manual"]), "evidence": s.DictField(required=False)})
def submit_verification(request, slug):
    v = C.submit_verification(_co(slug), request.user, method=request.input["method"], evidence=request.input.get("evidence"))
    return {"id": str(v.pk), "status": v.status}


@endpoint("[Administration] Demandes de verification en attente.", auth="staff")
def verification_queue(request):
    return paginate(request, CompanyVerification.objects.filter(status="pending").select_related("company"), ("created_at", "id"),
                    lambda v: {"id": str(v.pk), "company": v.company.slug, "method": v.method, "evidence": v.evidence, "created_at": v.created_at}, 30)


@endpoint("[Administration] Approuver ou rejeter une verification.", auth="staff", body={"approve": s.BooleanField(), "notes": s.CharField(max_length=500, required=False, allow_blank=True, default="")})
def review_verification(request, verification_id):
    v = C.review_verification(verification_id, request.user, approve=request.input["approve"], notes=request.input["notes"])
    return {"status": v.status}


@endpoint("[Editeur] Ajouter un lien (https).", status=201, body={"provider": s.CharField(max_length=12), "url": s.URLField(max_length=300)})
def add_link(request, slug):
    l = C.set_social_link(_co(slug), request.user, **request.input)
    return {"provider": l.provider, "url": l.url}


@endpoint("[Editeur] Ajouter un projet a la page.", status=201, body={"title": s.CharField(max_length=160), "description": s.CharField(max_length=5000, required=False, allow_blank=True), "url": s.URLField(required=False, allow_blank=True), "repo_url": s.URLField(required=False, allow_blank=True)})
def add_project(request, slug):
    p = C.add_project(_co(slug), request.user, **request.input)
    return {"id": str(p.pk)}


@endpoint("[Editeur] Ajouter un service propose.", status=201, body={"title": s.CharField(max_length=160), "description": s.CharField(max_length=3000, required=False, allow_blank=True), "starting_price_minor": s.IntegerField(min_value=1, required=False), "currency": s.CharField(max_length=3, required=False, allow_blank=True, default="")})
def add_service(request, slug):
    x = C.add_service(_co(slug), request.user, **request.input)
    return {"id": str(x.pk)}
