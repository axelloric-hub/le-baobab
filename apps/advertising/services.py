from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.advertising.models import (
    AdAccount, AdAccountTransaction, Advertisement, Advertiser, AdSet, AdUserPreference, Audience, AudienceMembership, Campaign, Creative, TargetingRule,
    PLACEMENTS, TARGETING_FIELDS,
)
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.outbox import publish_event


def _owner(user, advertiser: Advertiser) -> None:
    if not (user.is_staff or advertiser.owner_id == user.pk):
        raise PermissionDeniedError("Reserve au proprietaire du compte publicitaire.")
    if advertiser.status != "active":
        raise DomainError("Compte annonceur suspendu.", code="advertiser_suspended")


@transaction.atomic
def create_advertiser(owner, *, name: str, currency: str, company_ref=None) -> AdAccount:
    try:
        with transaction.atomic():
            adv = Advertiser.objects.create(owner=owner, name=name, company_ref=company_ref)
            return AdAccount.objects.create(advertiser=adv, currency=currency.upper())
    except IntegrityError as exc:
        raise ConflictError("Nom d'annonceur deja utilise ou devise vide.", code="invalid_advertiser") from exc


@transaction.atomic
def top_up(account_id, actor, *, amount_minor: int, reference: str) -> tuple[AdAccountTransaction, bool]:
    """Recharge IDEMPOTENTE par `reference` (identifiant de paiement) : un webhook rejoue ne credite jamais deux fois."""
    account = AdAccount.objects.select_for_update(of=("self",)).select_related("advertiser").get(pk=account_id)
    _owner(actor, account.advertiser)
    if amount_minor <= 0 or not reference.strip():
        raise DomainError("Montant positif et reference obligatoires.", code="invalid_topup")
    existing = AdAccountTransaction.objects.filter(account=account, reference=reference).first()
    if existing:
        return existing, False
    account.balance_minor += amount_minor
    account.save(update_fields=["balance_minor", "updated_at"])
    tx = AdAccountTransaction.objects.create(account=account, kind="topup", amount_minor=amount_minor, balance_after_minor=account.balance_minor, reference=reference)
    return tx, True


@transaction.atomic
def create_campaign(account: AdAccount, actor, *, name: str, starts_at, daily_budget_minor: int, total_budget_minor: int, ends_at=None, objective: str = "traffic") -> Campaign:
    _owner(actor, account.advertiser)
    try:
        with transaction.atomic():
            return Campaign.objects.create(account=account, name=name, objective=objective, starts_at=starts_at, ends_at=ends_at,
                                           daily_budget_minor=daily_budget_minor, total_budget_minor=total_budget_minor)
    except IntegrityError as exc:
        raise DomainError("Budgets incoherents (journalier > 0 et <= total) ou fin avant debut.", code="invalid_campaign") from exc


def _validate_rules(rules: list[dict]) -> None:
    for r in rules:
        if r["field"] not in TARGETING_FIELDS:
            raise DomainError(f"Critere de ciblage non autorise : {r['field']}.", code="targeting_not_allowed")
        if r.get("operator", "in") not in ("in", "all", "not_in"):
            raise DomainError("Operateur de ciblage inconnu.", code="invalid_operator")
        vals = r.get("values") or []
        if not vals or len(vals) > 50 or not all(isinstance(v, str) and 0 < len(v) <= 80 for v in vals):
            raise DomainError("Un critere exige 1 a 50 valeurs texte.", code="invalid_values")


@transaction.atomic
def create_ad_set(campaign: Campaign, actor, *, name: str, bid_minor: int, placements: list[str], billing_model: str = "cpc", frequency_cap_per_day: int = 3,
                  audience: Audience | None = None, rules: list[dict] | None = None) -> AdSet:
    _owner(actor, campaign.account.advertiser)
    if not placements or any(p not in PLACEMENTS for p in placements):
        raise DomainError("Emplacements invalides.", code="invalid_placement")
    if audience is not None and audience.advertiser_id != campaign.account.advertiser_id:
        raise PermissionDeniedError("Cette audience appartient a un autre annonceur.")
    rules = rules or []
    _validate_rules(rules)
    try:
        with transaction.atomic():
            s = AdSet.objects.create(campaign=campaign, name=name, bid_minor=bid_minor, placements=placements, billing_model=billing_model,
                                     frequency_cap_per_day=frequency_cap_per_day, audience=audience)
            TargetingRule.objects.bulk_create([TargetingRule(ad_set=s, field=r["field"], operator=r.get("operator", "in"), values=r["values"],
                                                             required=r.get("required", True), weight=r.get("weight", 1)) for r in rules])
    except IntegrityError as exc:
        raise DomainError("Enchere nulle, plafond de frequence hors 1-50 ou poids hors 1-10.", code="invalid_ad_set") from exc
    return s


@transaction.atomic
def create_creative(advertiser: Advertiser, actor, *, headline: str, destination_url: str, kind: str = "text", body: str = "", media_key: str = "", cta_label: str = "") -> Creative:
    _owner(actor, advertiser)
    try:
        with transaction.atomic():
            return Creative.objects.create(advertiser=advertiser, kind=kind, headline=headline, body=body, media_key=media_key, cta_label=cta_label, destination_url=destination_url)
    except IntegrityError as exc:
        raise DomainError("L'URL de destination doit etre en https ; une image/video exige un media.", code="invalid_creative") from exc


@transaction.atomic
def create_ad(ad_set: AdSet, creative: Creative, actor) -> Advertisement:
    _owner(actor, ad_set.campaign.account.advertiser)
    if creative.advertiser_id != ad_set.campaign.account.advertiser_id:
        raise PermissionDeniedError("Cette creation appartient a un autre annonceur.")
    return Advertisement.objects.create(ad_set=ad_set, creative=creative)


@transaction.atomic
def submit_for_review(ad: Advertisement, actor) -> Advertisement:
    _owner(actor, ad.ad_set.campaign.account.advertiser)
    if ad.status not in ("draft", "rejected"):
        raise ConflictError("Cette annonce ne peut pas etre soumise.", code="invalid_state")
    ad.status = "pending_review"
    ad.save(update_fields=["status"])
    publish_event("AdSubmitted", "ad", ad.pk, {})
    return ad


@transaction.atomic
def review_ad(ad_id, reviewer, *, approve: bool, notes: str = "") -> Advertisement:
    """Aucune annonce ne diffuse sans validation humaine (CHECK en base : active => reviewed_at)."""
    if not reviewer.is_staff:
        raise PermissionDeniedError("Reserve a la moderation.")
    ad = Advertisement.objects.select_for_update(of=("self",)).get(pk=ad_id)
    if ad.status != "pending_review":
        raise ConflictError("Annonce non soumise.", code="not_pending")
    ad.status, ad.reviewed_by, ad.reviewed_at, ad.review_notes = ("active" if approve else "rejected"), reviewer, timezone.now(), notes[:500]
    ad.save()
    publish_event("AdReviewed", "ad", ad.pk, {"approved": approve})
    return ad


@transaction.atomic
def activate_campaign(campaign: Campaign, actor) -> Campaign:
    _owner(actor, campaign.account.advertiser)
    campaign = Campaign.objects.select_for_update(of=("self",)).get(pk=campaign.pk)
    account = AdAccount.objects.get(pk=campaign.account_id)
    if campaign.status not in ("draft", "paused"):
        raise ConflictError("Campagne non activable.", code="invalid_state")
    if account.balance_minor <= 0:
        raise DomainError("Portefeuille vide : rechargez avant d'activer.", code="insufficient_funds")
    if not Advertisement.objects.filter(ad_set__campaign=campaign, status="active").exists():
        raise DomainError("Aucune annonce validee dans cette campagne.", code="no_active_ad")
    campaign.status, campaign.pause_reason = "active", ""
    campaign.save(update_fields=["status", "pause_reason", "updated_at"])
    return campaign


@transaction.atomic
def pause_campaign(campaign: Campaign, actor) -> Campaign:
    _owner(actor, campaign.account.advertiser)
    Campaign.objects.filter(pk=campaign.pk, status="active").update(status="paused", pause_reason="manual", updated_at=timezone.now())
    campaign.refresh_from_db()
    return campaign


@transaction.atomic
def add_to_audience(audience: Audience, actor, users) -> int:
    _owner(actor, audience.advertiser)
    created = AudienceMembership.objects.bulk_create([AudienceMembership(audience=audience, user=u) for u in users], ignore_conflicts=True)
    return len(created)


def set_personalization(user, enabled: bool) -> AdUserPreference:
    return AdUserPreference.objects.update_or_create(user=user, defaults={"personalized_ads": enabled, "updated_at": timezone.now()})[0]
