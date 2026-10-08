"""Fabriques de test de la publicite."""
from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace

from django.utils import timezone

from apps.advertising import services as A
from apps.core.testing import make_user


def make_live_ad(*, balance=100_000, daily=50_000, total=500_000, bid=5, billing="cpc", freq=3, rules=None, placements=("feed",), advertiser_user=None, account=None, name="Camp"):
    owner = advertiser_user or make_user()
    acct = account or A.create_advertiser(owner, name=f"Annonceur-{owner.username}", currency="XAF")
    if not account:
        A.top_up(acct.pk, owner, amount_minor=balance, reference=f"init-{owner.pk}")
        acct.refresh_from_db()
    camp = A.create_campaign(acct, owner, name=name, starts_at=timezone.now() - timedelta(hours=1), daily_budget_minor=daily, total_budget_minor=total)
    ad_set = A.create_ad_set(camp, owner, name="AS", bid_minor=bid, placements=list(placements), billing_model=billing, frequency_cap_per_day=freq, rules=rules or [])
    creative = A.create_creative(acct.advertiser, owner, headline="Apprenez Django", destination_url="https://baobab.example.com/cours/django")
    ad = A.create_ad(ad_set, creative, owner)
    A.submit_for_review(ad, owner)
    admin = make_user(); admin.is_staff = True; admin.save()
    A.review_ad(ad.pk, admin, approve=True)
    A.activate_campaign(camp, owner)
    ad.refresh_from_db(); camp.refresh_from_db()
    return SimpleNamespace(owner=owner, account=acct, campaign=camp, ad_set=ad_set, ad=ad, admin=admin)


def user_with(skills=(), country=None, languages=None):
    from apps.profiles.models import Skill, UserSkill
    u = make_user()
    for slug in skills:
        UserSkill.objects.create(user=u, skill=Skill.objects.get(slug=slug), level=3)
    if country:
        u.profile.country_id = country
        u.profile.languages = languages or ["fr"]
        u.profile.save()
    return u
