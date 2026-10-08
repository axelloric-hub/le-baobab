"""Fabriques de test du recrutement."""
from __future__ import annotations

from types import SimpleNamespace

from apps.companies import services as C
from apps.core.testing import make_user
from apps.jobs import services as J
from apps.profiles.models import Skill

DESCRIPTION = "Nous recherchons un developpeur backend Django pour construire la plateforme LE BAOBAB et ses API."


def make_company_job(*, job_type="full_time", contract_type="permanent", publish=True):
    owner, recruiter = make_user(), make_user()
    company = C.create_company(owner, name="Afrik Tech", slug=f"afrik-{owner.username}")
    C.add_member(company, owner, recruiter, role="recruiter")
    skill = Skill.objects.get(slug="django")
    kw = {"company": company} if job_type != "freelance" else {}
    job = J.create_job(recruiter if job_type != "freelance" else owner, title="Dev Django", description=DESCRIPTION, job_type=job_type, contract_type=contract_type,
                       skills=[{"skill": skill, "required": True}], salary={"min": 300_000, "max": 600_000, "currency": "XAF", "period": "month"}, **kw)
    if publish:
        J.publish_job(job, job.posted_by)
    return SimpleNamespace(owner=owner, recruiter=recruiter, company=company, job=job, skill=skill)
