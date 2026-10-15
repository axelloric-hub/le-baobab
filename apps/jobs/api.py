"""Emplois et freelance : offres, candidatures (machine a etats), entretiens (creneaux), offres d'embauche, propositions, contrats et jalons. Un candidat ne voit que SES candidatures ; un recruteur que celles de SES offres."""
from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers as s
from rest_framework.response import Response

from apps.companies.models import Company
from apps.core.api import endpoint, get_or_404, paginate
from apps.core.exceptions import PermissionDeniedError
from apps.jobs import services as J
from apps.jobs.models import Contract, FreelancerProfile, InterviewSlot, Job, JobApplication, Milestone, Offer, Proposal
from apps.profiles.models import Country, Skill
from apps.profiles.render import file_url, user_brief
from apps.storage.services import resolve_owned, signed_url

ST = [c[0] for c in JobApplication.Status.choices]


def _jobs():
    return Job.objects.select_related("company", "country", "category", "posted_by__profile").prefetch_related("job_skills__skill")


def _job(request, job_id, *, manage=False) -> Job:
    j = get_or_404(_jobs().filter(pk=job_id))
    mine = request.user.is_authenticated and J.can_manage_job(request.user, j)
    if manage and not mine:
        get_or_404(Job.objects.none())
    if not mine and j.status != "open":
        get_or_404(Job.objects.none())
    return j


def _job_json(j: Job, viewer: dict | None = None) -> dict:
    co = j.company
    return {"id": str(j.pk), "title": j.title, "description": j.description,
            "company": {"slug": co.slug, "name": co.name, "logo_url": file_url(co.logo_key), "verified": co.status == "verified"} if j.company_id else None,
            "posted_by": user_brief(j.posted_by), "job_type": j.job_type,
            "contract_type": j.contract_type, "experience_level": j.experience_level, "remote_policy": j.remote_policy, "country": j.country_id,
            "country_name": j.country.name if j.country_id else None, "city": j.city,
            "salary": {"min_minor": j.salary_min_minor, "max_minor": j.salary_max_minor, "currency": j.salary_currency, "period": j.salary_period} if j.salary_min_minor is not None else None,
            "skills": [{"slug": js.skill.slug, "name": js.skill.name, "required": js.is_required} for js in j.job_skills.all()], "status": j.status, "published_at": j.published_at,
            "deadline": j.deadline, "created_at": j.created_at, "viewer": viewer}


class _Viewer:
    """Etat propre au lecteur (je gere l'offre ? ma candidature ? ma proposition ?), calcule en 3 requetes pour toute une page."""

    def __init__(self, user):
        self.user = user if user.is_authenticated else None
        if not self.user:
            return
        self.apps = {a["job_id"]: {"id": str(a["id"]), "status": a["status"]} for a in JobApplication.objects.filter(applicant=user).values("id", "job_id", "status")}
        self.props = {p["job_id"]: {"id": str(p["id"]), "status": p["status"]} for p in Proposal.objects.filter(freelancer=user).values("id", "job_id", "status")}
        self.companies = set(J.recruiter_company_ids(user))

    def __call__(self, j: Job) -> dict | None:
        if not self.user:
            return None
        manage = self.user.is_staff or j.posted_by_id == self.user.pk or (j.company_id in self.companies)
        return {"can_manage": manage, "application": self.apps.get(j.pk), "proposal": self.props.get(j.pk)}


class _Salary(s.Serializer):
    min = s.IntegerField(min_value=0)
    max = s.IntegerField(min_value=0)
    currency = s.CharField(min_length=3, max_length=3)
    period = s.ChoiceField(choices=["hour", "day", "month", "year"])


class _SkillIn(s.Serializer):
    slug = s.CharField(max_length=80)
    required = s.BooleanField(default=True)


@endpoint("Offres ouvertes (emplois et missions freelance).", auth="public", query={"q": s.CharField(required=False, max_length=60), "type": s.CharField(required=False), "remote": s.CharField(required=False), "country": s.CharField(required=False, max_length=2),
                                                                                  "skill": s.CharField(required=False), "company": s.SlugField(required=False), "level": s.CharField(required=False)})
def list_jobs(request):
    now = timezone.now()
    qs = _jobs().filter(status="open").filter(Q(deadline__isnull=True) | Q(deadline__gt=now))
    q = request.q
    for param, field in (("type", "job_type"), ("remote", "remote_policy"), ("level", "experience_level")):
        if q.get(param):
            qs = qs.filter(**{field: q[param]})
    if q.get("q"):
        qs = qs.filter(title__icontains=q["q"])
    if q.get("country"):
        qs = qs.filter(country_id=q["country"].upper())
    if q.get("skill"):
        qs = qs.filter(job_skills__skill__slug=q["skill"])
    if q.get("company"):
        qs = qs.filter(company__slug=q["company"])
    viewer = _Viewer(request.user)
    return paginate(request, qs.distinct(), ("-published_at", "-id"), lambda j: _job_json(j, viewer(j)), 20)


@endpoint("Detail d'une offre (avec, pour un membre connecte, son etat : gestionnaire, candidature, proposition).", auth="optional")
def get_job(request, job_id):
    j = _job(request, job_id)
    return _job_json(j, _Viewer(request.user)(j))


@endpoint("Les offres que je gere (publiees par moi ou par une entreprise dont je suis recruteur), tous statuts, avec le nombre de candidatures et de propositions.")
def my_jobs(request):
    qs = (_jobs().filter(Q(posted_by=request.user) | Q(company_id__in=J.recruiter_company_ids(request.user)))
          .annotate(n_apps=Count("applications", distinct=True), n_new=Count("applications", filter=Q(applications__status="submitted"), distinct=True),
                    n_props=Count("proposals", distinct=True)))
    viewer = _Viewer(request.user)
    return paginate(request, qs, ("-created_at", "-id"),
                    lambda j: {**_job_json(j, viewer(j)), "counts": {"applications": j.n_apps, "new_applications": j.n_new, "proposals": j.n_props}}, 20)


@endpoint("[Recruteur] Modifier une offre (brouillon, ouverte ou en pause). Le type et le contrat ne changent pas.",
          body={"title": s.CharField(max_length=160, required=False), "description": s.CharField(max_length=20000, required=False),
                "experience_level": s.ChoiceField(choices=[c[0] for c in Job.Level.choices], required=False), "remote_policy": s.ChoiceField(choices=[c[0] for c in Job.Remote.choices], required=False),
                "country": s.CharField(max_length=2, required=False, allow_blank=True, allow_null=True), "city": s.CharField(max_length=80, required=False, allow_blank=True),
                "salary": _Salary(required=False, allow_null=True), "skills": s.ListField(child=_SkillIn(), required=False, max_length=30), "deadline": s.DateTimeField(required=False, allow_null=True)})
def update_job(request, job_id):
    d, j = dict(request.input), _job(request, job_id, manage=True)
    if "skills" in d:
        d["skills"] = [{"skill": get_or_404(Skill.objects.filter(slug=sk["slug"])), "required": sk["required"]} for sk in d["skills"]]
    if "country" in d:
        d["country"] = get_or_404(Country.objects.filter(code=d["country"].upper())) if d["country"] else None
    if d.get("salary"):
        d["salary"] = {**d["salary"], "currency": d["salary"]["currency"].upper()}
    J.update_job(j, request.user, **d)
    j = _jobs().get(pk=j.pk)
    return _job_json(j, _Viewer(request.user)(j))


@endpoint("Creer une offre (brouillon). Un emploi exige une entreprise dont vous etes recruteur ; une mission freelance peut etre publiee a titre individuel.", status=201,
          body={"company": s.SlugField(required=False), "title": s.CharField(max_length=160), "description": s.CharField(max_length=20000), "job_type": s.ChoiceField(choices=[c[0] for c in Job.Type.choices]),
                "contract_type": s.ChoiceField(choices=[c[0] for c in Job.Contract.choices]), "experience_level": s.ChoiceField(choices=[c[0] for c in Job.Level.choices], default="mid"),
                "remote_policy": s.ChoiceField(choices=[c[0] for c in Job.Remote.choices], default="onsite"), "country": s.CharField(max_length=2, required=False), "city": s.CharField(max_length=80, required=False, allow_blank=True, default=""),
                "salary": _Salary(required=False), "skills": s.ListField(child=_SkillIn(), required=False, max_length=30), "deadline": s.DateTimeField(required=False)})
def create_job(request):
    d = request.input
    company = get_or_404(Company.objects.filter(slug=d["company"])) if d.get("company") else None
    skills = []
    for sk in d.get("skills", []):
        skill = get_or_404(Skill.objects.filter(slug=sk["slug"]))
        skills.append({"skill": skill, "required": sk["required"]})
    extra = {k: d[k] for k in ("experience_level", "remote_policy", "city", "deadline") if k in d}
    if d.get("country"):
        extra["country"] = get_or_404(Country.objects.filter(code=d["country"].upper()))
    sal = d.get("salary")
    j = J.create_job(request.user, title=d["title"], description=d["description"], job_type=d["job_type"], contract_type=d["contract_type"], company=company, skills=skills,
                     salary={"min": sal["min"], "max": sal["max"], "currency": sal["currency"].upper(), "period": sal["period"]} if sal else None, **extra)
    j = _jobs().get(pk=j.pk)
    return _job_json(j, _Viewer(request.user)(j))


@endpoint("[Recruteur] Publier l'offre.")
def publish_job(request, job_id):
    J.publish_job(_job(request, job_id, manage=True), request.user)
    j = _jobs().get(pk=job_id)
    return _job_json(j, _Viewer(request.user)(j))


@endpoint("[Recruteur] Fermer l'offre (filled=true : poste pourvu).", body={"filled": s.BooleanField(default=False)})
def close_job(request, job_id):
    J.close_job(_job(request, job_id, manage=True), request.user, filled=request.input["filled"])
    j = _jobs().get(pk=job_id)
    return _job_json(j, _Viewer(request.user)(j))


# ------------------------------------------------------------------ candidatures
def _interview(iv) -> dict:
    sl = iv.slot
    return {"id": str(iv.pk), "mode": iv.mode, "location": iv.location, "status": iv.status,
            "starts_at": sl.starts_at if sl else None, "ends_at": sl.ends_at if sl else None}


def _offer(o: Offer) -> dict:
    return {"id": str(o.pk), "amount_minor": o.amount_minor, "currency": o.currency, "period": o.period, "start_date": o.start_date, "expires_at": o.expires_at, "status": o.status}


def _app(a: JobApplication, *, manager: bool) -> dict:
    co = a.job.company
    offers = sorted(a.offers.all(), key=lambda o: o.created_at)
    out = {"id": str(a.pk), "job": {"id": str(a.job_id), "title": a.job.title, "job_type": a.job.job_type, "status": a.job.status,
                                     "company": {"slug": co.slug, "name": co.name, "logo_url": file_url(co.logo_key)} if co else None},
           "status": a.status, "interviews": [_interview(iv) for iv in a.interviews.all()], "offer": _offer(offers[-1]) if offers else None, "cover_letter": a.cover_letter, "portfolio_url": a.portfolio_url, "github_url": a.github_url, "gitlab_url": a.gitlab_url,
           "cv_url": signed_url(a.cv_storage_key) if a.cv_storage_key else None, "available_from": a.available_from, "created_at": a.created_at,
           "projects": [{"id": str(p.pk), "title": p.title} for p in a.projects.all()], "history": [{"from": h.from_status, "to": h.to_status, "note": h.note, "at": h.created_at} for h in a.history.all()]}
    if manager:
        out["applicant"] = user_brief(a.applicant)
        out["expected_salary_minor"] = a.expected_salary_minor
    return out


def _app_qs():
    return JobApplication.objects.select_related("job__company", "applicant__profile").prefetch_related("projects", "history", "interviews__slot", "offers")


@endpoint("Postuler a une offre (une seule candidature par offre). cv_file : fichier envoye (usage 'cv').", status=201,
          body={"cover_letter": s.CharField(max_length=10000, required=False, allow_blank=True, default=""), "cv_file": s.UUIDField(required=False), "portfolio_url": s.URLField(required=False, allow_blank=True, default=""),
                "github_url": s.URLField(required=False, allow_blank=True, default=""), "gitlab_url": s.URLField(required=False, allow_blank=True, default=""), "projects": s.ListField(child=s.UUIDField(), required=False, max_length=10),
                "expected_salary_minor": s.IntegerField(min_value=0, required=False), "available_from": s.DateField(required=False)})
def apply(request, job_id):
    d = request.input
    _job(request, job_id)
    cv = resolve_owned(request.user, d["cv_file"], ("cv",)).key if d.get("cv_file") else ""
    app = J.apply(job_id, request.user, cover_letter=d["cover_letter"], cv_storage_key=cv, project_ids=d.get("projects", []), portfolio_url=d["portfolio_url"], github_url=d["github_url"], gitlab_url=d["gitlab_url"],
                  expected_salary_minor=d.get("expected_salary_minor"), available_from=d.get("available_from"))
    return _app(_app_qs().get(pk=app.pk), manager=False)


@endpoint("Mes candidatures.")
def my_applications(request):
    return paginate(request, _app_qs().filter(applicant=request.user), ("-created_at", "-id"), lambda a: _app(a, manager=False), 20)


@endpoint("[Recruteur] Candidatures recues pour une offre.", query={"status": s.ChoiceField(choices=ST, required=False)})
def job_applications(request, job_id):
    j = _job(request, job_id, manage=True)
    qs = _app_qs().filter(job=j)
    if request.q.get("status"):
        qs = qs.filter(status=request.q["status"])
    return paginate(request, qs, ("-created_at", "-id"), lambda a: _app(a, manager=True), 30)


@endpoint("Detail d'une candidature (le candidat ou les recruteurs de l'offre ; sinon 404).")
def get_application(request, application_id):
    a = get_or_404(_app_qs().filter(pk=application_id))
    manager = J.can_manage_job(request.user, a.job)
    if not manager and a.applicant_id != request.user.pk:
        get_or_404(JobApplication.objects.none())
    return _app(a, manager=manager)


@endpoint("Changer le statut d'une candidature. Recruteur : reviewing, shortlisted, interview, offer, hired, rejected. Candidat : withdrawn. Seules les transitions valides sont acceptees.",
          body={"to_status": s.ChoiceField(choices=ST), "note": s.CharField(max_length=500, required=False, allow_blank=True, default="")})
def transition(request, application_id):
    a = get_or_404(JobApplication.objects.filter(pk=application_id).select_related("job"))
    if a.applicant_id != request.user.pk and not J.can_manage_job(request.user, a.job):
        get_or_404(JobApplication.objects.none())
    J.transition_application(application_id, request.user, request.input["to_status"], request.input["note"])
    return _app(_app_qs().get(pk=application_id), manager=J.can_manage_job(request.user, a.job))


# ------------------------------------------------------------------ entretiens, offres
def _slot(sl: InterviewSlot) -> dict:
    return {"id": str(sl.pk), "starts_at": sl.starts_at, "ends_at": sl.ends_at, "booked": sl.booked_by_id is not None}


@endpoint("[Recruteur] Proposer un creneau d'entretien (deux creneaux d'un meme recruteur ne peuvent pas se chevaucher).", status=201, body={"starts_at": s.DateTimeField(), "ends_at": s.DateTimeField()})
def create_slot(request, job_id):
    return _slot(J.create_slot(request.user, _job(request, job_id, manage=True), **request.input))


@endpoint("Creneaux libres (recruteurs ; candidats pre-selectionnes de cette offre).")
def list_slots(request, job_id):
    j = _job(request, job_id)
    if not J.can_manage_job(request.user, j) and not JobApplication.objects.filter(job=j, applicant=request.user, status__in=["shortlisted", "interview"]).exists():
        get_or_404(Job.objects.none())
    return [_slot(x) for x in InterviewSlot.objects.filter(job=j, booked_by__isnull=True, starts_at__gt=timezone.now()).order_by("starts_at")]


@endpoint("Reserver un creneau pour une candidature (candidat ou recruteur) : passe la candidature en 'interview'.", status=201, body={"slot": s.UUIDField(), "mode": s.ChoiceField(choices=["video", "phone", "onsite"], default="video"), "location": s.CharField(max_length=300, required=False, allow_blank=True, default="")})
def book(request, application_id):
    a = get_or_404(JobApplication.objects.filter(pk=application_id).select_related("job"))
    if a.applicant_id != request.user.pk and not J.can_manage_job(request.user, a.job):
        get_or_404(JobApplication.objects.none())
    iv = J.book_slot(application_id, request.input["slot"], request.user, mode=request.input["mode"], location=request.input["location"])
    return {"id": str(iv.pk), "status": iv.status}


@endpoint("[Recruteur] Envoyer une offre d'embauche (apres un entretien).", status=201, body={"amount_minor": s.IntegerField(min_value=1), "currency": s.CharField(min_length=3, max_length=3), "period": s.ChoiceField(choices=["hour", "day", "month", "year"], default="month"),
                                                                                           "start_date": s.DateField(required=False), "valid_days": s.IntegerField(min_value=1, max_value=60, default=7)})
def make_offer(request, application_id):
    a = get_or_404(JobApplication.objects.filter(pk=application_id).select_related("job"))
    if not J.can_manage_job(request.user, a.job):
        get_or_404(JobApplication.objects.none())
    o = J.make_offer(application_id, request.user, **request.input)
    return {"id": str(o.pk), "status": o.status, "expires_at": o.expires_at}


@endpoint("Mes offres d'embauche recues.")
def my_offers(request):
    return [{"id": str(o.pk), "job": o.application.job.title, "job_id": str(o.application.job_id), "application": str(o.application_id), "amount_minor": o.amount_minor, "currency": o.currency,
             "period": o.period, "start_date": o.start_date, "expires_at": o.expires_at, "status": o.status}
            for o in Offer.objects.filter(application__applicant=request.user).select_related("application__job").order_by("-created_at")]


@endpoint("Accepter ou refuser une offre d'embauche (l'acceptation cree le contrat).", body={"accept": s.BooleanField()})
def respond_offer(request, offer_id):
    o = J.respond_to_offer(offer_id, request.user, accept=request.input["accept"])
    return {"status": o.status}


# ------------------------------------------------------------------ freelance
@endpoint("Mon profil freelance.")
def my_freelancer(request):
    p = FreelancerProfile.objects.filter(user=request.user).first()
    return {"headline": p.headline, "hourly_rate_minor": p.hourly_rate_minor, "currency": p.currency, "is_available": p.is_available, "languages": p.languages} if p else None


@endpoint("Creer/mettre a jour mon profil freelance (un tarif exige une devise).", body={"headline": s.CharField(max_length=160, required=False, allow_blank=True), "hourly_rate_minor": s.IntegerField(min_value=1, required=False, allow_null=True),
                                                                                       "currency": s.CharField(max_length=3, required=False, allow_blank=True), "is_available": s.BooleanField(required=False), "languages": s.CharField(max_length=100, required=False, allow_blank=True)})
def put_freelancer(request):
    p = J.upsert_freelancer_profile(request.user, **request.input)
    return {"headline": p.headline, "hourly_rate_minor": p.hourly_rate_minor, "currency": p.currency, "is_available": p.is_available}


@endpoint("Repondre a une mission freelance par une proposition (une par mission).", status=201, body={"cover_letter": s.CharField(max_length=10000), "bid_minor": s.IntegerField(min_value=1), "currency": s.CharField(min_length=3, max_length=3), "delivery_days": s.IntegerField(min_value=1, max_value=3650)})
def submit_proposal(request, job_id):
    _job(request, job_id)
    p = J.submit_proposal(job_id, request.user, **request.input)
    return {"id": str(p.pk), "status": p.status}


@endpoint("[Client] Propositions recues pour une mission.")
def job_proposals(request, job_id):
    j = _job(request, job_id, manage=True)
    return paginate(request, Proposal.objects.filter(job=j).select_related("freelancer__profile"), ("-created_at", "-id"),
                    lambda p: {"id": str(p.pk), "freelancer": user_brief(p.freelancer), "cover_letter": p.cover_letter, "bid_minor": p.bid_minor, "currency": p.currency, "delivery_days": p.delivery_days,
                               "status": p.status, "created_at": p.created_at}, 30)


@endpoint("Mes propositions.")
def my_proposals(request):
    return [{"id": str(p.pk), "job": {"id": str(p.job_id), "title": p.job.title, "status": p.job.status}, "cover_letter": p.cover_letter, "bid_minor": p.bid_minor, "currency": p.currency,
             "delivery_days": p.delivery_days, "status": p.status, "created_at": p.created_at}
            for p in Proposal.objects.filter(freelancer=request.user).select_related("job").order_by("-created_at")[:200]]


class _MilestoneIn(s.Serializer):
    title = s.CharField(max_length=160)
    amount_minor = s.IntegerField(min_value=1)
    due_on = s.DateField(required=False)


@endpoint("[Client] Accepter une proposition : cree le contrat et ses jalons (leur somme doit egaler l'offre), refuse les autres propositions, marque la mission pourvue.", status=201, body={"milestones": s.ListField(child=_MilestoneIn(), required=False, max_length=20)})
def accept_proposal(request, proposal_id):
    p = get_or_404(Proposal.objects.filter(pk=proposal_id).select_related("job"))
    if not J.can_manage_job(request.user, p.job):
        get_or_404(Proposal.objects.none())
    c = J.accept_proposal(proposal_id, request.user, milestones=[dict(m) for m in request.input.get("milestones", [])] or None)
    return _contract(Contract.objects.prefetch_related("milestones").get(pk=c.pk))


def _contract(c: Contract) -> dict:
    title = c.proposal.job.title if c.proposal_id else (c.application.job.title if c.application_id else "")
    return {"id": str(c.pk), "kind": c.kind, "title": title, "client": user_brief(c.client), "contractor": user_brief(c.contractor), "amount_minor": c.amount_minor, "currency": c.currency, "status": c.status,
            "start_date": c.start_date, "end_date": c.end_date, "milestones": [{"id": str(m.pk), "position": m.position, "title": m.title, "amount_minor": m.amount_minor, "due_on": m.due_on, "status": m.status} for m in c.milestones.order_by("position")]}


@endpoint("Mes contrats (comme client ou prestataire).")
def my_contracts(request):
    qs = (Contract.objects.filter(Q(client=request.user) | Q(contractor=request.user))
          .select_related("client__profile", "contractor__profile", "proposal__job", "application__job").prefetch_related("milestones"))
    return paginate(request, qs, ("-created_at", "-id"), _contract, 20)


@endpoint("Detail d'un contrat (parties uniquement).")
def get_contract(request, contract_id):
    return _contract(get_or_404(Contract.objects.filter(pk=contract_id).filter(Q(client=request.user) | Q(contractor=request.user)).select_related("client__profile", "contractor__profile").prefetch_related("milestones")))


@endpoint("Faire avancer un jalon : start et submit par le prestataire, approve par le client. Le contrat se termine quand tous les jalons sont valides.", body={"action": s.ChoiceField(choices=["start", "submit", "approve"])})
def advance_milestone(request, milestone_id):
    m = get_or_404(Milestone.objects.filter(pk=milestone_id).filter(Q(contract__client=request.user) | Q(contract__contractor=request.user)))
    return {"status": J.advance_milestone(m.pk, request.user, request.input["action"]).status}


@endpoint("Resilier un contrat (l'une des parties).")
def terminate(request, contract_id):
    get_or_404(Contract.objects.filter(pk=contract_id).filter(Q(client=request.user) | Q(contractor=request.user)))
    return {"status": J.terminate_contract(contract_id, request.user).status}
