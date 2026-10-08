"""Diffusion : selection des annonces, evenements, reglement des depenses.
Ordre de FIABILITE : plafond de frequence et garde-fou de budget (Redis, temps reel, approximatifs mais bornes) -> evenements bruts (MongoDB) ->
REGLEMENT (PostgreSQL, verite financiere, idempotent, rejouable). Perdre Redis peut sous-facturer un peu ; ne peut JAMAIS sur-facturer ni creer de dette."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone as dt_tz

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.advertising.models import MICRO, AdAccount, AdAccountTransaction, Advertisement, AdSettlement, AdUserPreference, Campaign
from apps.advertising.targeting import Rule, UserContext, evaluate
from apps.core import redis as R
from apps.core import redis_keys as K
from apps.core.mongo import collection
from apps.core.outbox import publish_event

EVENTS = "ad_events"
EVENT_TTL_DAYS = 60
CLICK_WINDOW = timedelta(hours=24)
CONVERSION_WINDOW = timedelta(days=7)


def _today() -> str:
    return timezone.now().date().isoformat()


# ------------------------------------------------------------------ contexte utilisateur (criteres AUTORISES uniquement)
def build_context(user, extra: dict | None = None) -> UserContext:
    """Construit le contexte depuis le profil. `extra` : signaux fournis par l'analytique (categories suivies, types de contenu consultes)."""
    from apps.profiles.models import Profile, UserInterest, UserSkill

    pref = AdUserPreference.objects.filter(user=user).first()
    skills = list(UserSkill.objects.filter(user=user).select_related("skill"))
    profile = Profile.objects.filter(user=user).select_related("country", "profession").first()
    top = max((s.level for s in skills), default=0)
    values = {
        "skill": frozenset(s.skill.slug for s in skills),
        "technology": frozenset(s.skill.slug for s in skills if s.skill.is_technology),
        "domain": frozenset(s.skill.slug for s in skills if s.skill.kind == "domain"),
        "interest": frozenset(UserInterest.objects.filter(user=user).values_list("interest__slug", flat=True)),
        "level": frozenset({"junior" if top <= 2 else "mid" if top == 3 else "senior"}) if skills else frozenset(),
    }
    if profile:
        values["profession"] = frozenset([profile.profession.slug]) if profile.profession_id else frozenset()
        values["country"] = frozenset([profile.country_id.lower()]) if profile.country_id else frozenset()
        values["region"] = frozenset([profile.region.lower()]) if profile.region else frozenset()
        values["language"] = frozenset(profile.languages or [])
        values["availability"] = frozenset([profile.availability])
    for k, v in (extra or {}).items():
        values[k] = frozenset(v)
    return UserContext(user_id=str(user.pk), personalized=(pref.personalized_ads if pref else True), values=values)


# ------------------------------------------------------------------ budget
def _settled_micro(campaign_id) -> int:
    return int(AdSettlement.objects.filter(ad__ad_set__campaign_id=campaign_id).aggregate(s=Sum("spend_micro"))["s"] or 0)


def _caps(campaign: Campaign) -> tuple[int, int]:
    return campaign.daily_budget_minor * MICRO, campaign.total_budget_minor * MICRO


def _total_counter(campaign: Campaign) -> int:
    r = R.get_redis()
    key = K.ad_gate_total(campaign.pk)
    r.set(key, _settled_micro(campaign.pk), nx=True, ex=400 * 86400)  # (re)initialise depuis PostgreSQL si Redis a perdu la cle
    return int(r.get(key))


def budget_available(campaign: Campaign, need_micro: int) -> bool:
    daily_cap, total_cap = _caps(campaign)
    daily = int(R.get_redis().get(K.ad_gate_day(campaign.pk, _today())) or 0)
    return daily + need_micro <= daily_cap and _total_counter(campaign) + need_micro <= total_cap


def reserve_budget(campaign: Campaign, cost_micro: int) -> bool:
    """Reservation ATOMIQUE (INCRBY puis controle, annulation si depassement) : deux evenements simultanes ne peuvent pas depasser le plafond."""
    daily_cap, total_cap = _caps(campaign)
    r = R.get_redis()
    _total_counter(campaign)
    dkey = K.ad_gate_day(campaign.pk, _today())
    day = r.incrby(dkey, cost_micro)
    r.expire(dkey, 2 * 86400)
    total = r.incrby(K.ad_gate_total(campaign.pk), cost_micro)
    if day > daily_cap or total > total_cap:
        r.decrby(dkey, cost_micro)
        r.decrby(K.ad_gate_total(campaign.pk), cost_micro)
        return False
    return True


# ------------------------------------------------------------------ selection
def _candidates(placement: str, now: datetime):
    return (Advertisement.objects.filter(status="active", ad_set__status="active", ad_set__campaign__status="active", ad_set__campaign__starts_at__lte=now,
                                         ad_set__campaign__account__balance_minor__gt=0, ad_set__campaign__account__advertiser__status="active")
            .exclude(ad_set__campaign__ends_at__lt=now).filter(ad_set__placements__contains=[placement])
            .select_related("creative", "ad_set__campaign__account", "ad_set__audience").prefetch_related("ad_set__rules"))


def select_ads(user, placement: str, *, limit: int = 1, now: datetime | None = None, extra: dict | None = None) -> list[Advertisement]:
    """Annonces eligibles (ciblage, audience, budget, plafond de frequence) classees par valeur attendue par impression."""
    now = now or timezone.now()
    ctx = build_context(user, extra)
    ads = list(_candidates(placement, now))
    if not ads:
        return []
    stats = {r["ad_id"]: r for r in AdSettlement.objects.filter(ad__in=ads).values("ad_id").annotate(i=Sum("impressions"), c=Sum("clicks"))}
    member_of = None  # charge a la demande (une seule requete)
    scored = []
    for ad in ads:
        s = ad.ad_set
        rules = [Rule(r.field, r.operator, tuple(r.values), r.required, r.weight) for r in s.rules.all()]
        if s.audience_id is not None:
            if not ctx.personalized:
                continue
            if member_of is None:
                from apps.advertising.models import AudienceMembership
                member_of = set(AudienceMembership.objects.filter(user=user).values_list("audience_id", flat=True))
            if s.audience_id not in member_of:
                continue
        ok, bonus = evaluate(rules, ctx)
        if not ok:
            continue
        need = s.bid_minor * 1000 if s.billing_model == "cpm" else s.bid_minor * MICRO
        if not budget_available(s.campaign, need):
            continue
        used = int(R.get_redis().get(K.ad_freq(ad.pk, user.pk, _today())) or 0)
        if used >= s.frequency_cap_per_day:
            continue
        st = stats.get(ad.pk, {"i": 0, "c": 0})
        ctr = ((st["c"] or 0) + 1) / ((st["i"] or 0) + 20)  # CTR lisse : une annonce neuve n'est ni favorisee ni enterree
        value = (s.bid_minor / 1000 if s.billing_model == "cpm" else s.bid_minor * ctr) * (1 + bonus / 10)
        scored.append((value, str(ad.pk), ad))
    scored.sort(key=lambda t: (-t[0], t[1]))
    return [t[2] for t in scored[:limit]]


# ------------------------------------------------------------------ evenements
def _hash_ip(ip: str | None) -> str | None:
    return hashlib.sha256(ip.encode()).hexdigest()[:16] if ip else None


def _event(kind: str, key: str, ad: Advertisement, user_id, **extra) -> None:
    now = timezone.now()
    collection(EVENTS).replace_one({"_id": key}, {"_id": key, "type": kind, "ad_id": str(ad.pk), "campaign_id": str(ad.ad_set.campaign_id), "user_id": str(user_id),
                                                  "ts": now, "expires_at": now + timedelta(days=EVENT_TTL_DAYS), **extra}, upsert=True)


def _accumulate(ad: Advertisement, **incr: int) -> None:
    r = R.get_redis()
    key = K.ad_acc(ad.pk, _today())
    pipe = r.pipeline()
    for field_, v in incr.items():
        pipe.hincrby(key, field_, v)
    pipe.expire(key, 3 * 86400)
    pipe.execute()


def record_impression(ad_id, user, placement: str, impression_id: str) -> bool:
    """Retourne True si l'impression est comptee. Faux si : doublon, plafond de frequence atteint, budget epuise, annonce non diffusable."""
    ad = Advertisement.objects.select_related("ad_set__campaign").filter(pk=ad_id, status="active", ad_set__status="active", ad_set__campaign__status="active").first()
    if ad is None or placement not in ad.ad_set.placements:
        return False
    r = R.get_redis()
    if not r.set(K.ad_dedupe("imp", impression_id), 1, nx=True, ex=86400):
        return False  # meme impression rapportee deux fois (rafraichissement, rejeu reseau)
    s = ad.ad_set
    allowed, _ = R.capped_incr(K.ad_freq(ad.pk, user.pk, _today()), s.frequency_cap_per_day, 86400)
    if not allowed:
        r.delete(K.ad_dedupe("imp", impression_id))
        return False
    cost = s.bid_minor * 1000 if s.billing_model == "cpm" else 0
    if cost and not reserve_budget(s.campaign, cost):
        r.delete(K.ad_dedupe("imp", impression_id))
        return False
    _accumulate(ad, impressions=1, spend_micro=cost)
    _event("impression", f"imp:{impression_id}", ad, user.pk, placement=placement)
    return True


def record_click(impression_id: str, user, *, ip: str | None = None) -> bool:
    imp = collection(EVENTS).find_one({"_id": f"imp:{impression_id}"})
    if imp is None or imp["user_id"] != str(user.pk):
        return False  # on ne clique pas sur une impression inconnue ou d'un autre utilisateur (fraude)
    ts = imp["ts"] if imp["ts"].tzinfo else imp["ts"].replace(tzinfo=dt_tz.utc)
    if timezone.now() - ts > CLICK_WINDOW:
        return False
    allowed, _, _ = R.rate_limit("ad_click", user.pk, 30, 60)
    if not allowed:
        return False
    ad = Advertisement.objects.select_related("ad_set__campaign").filter(pk=imp["ad_id"]).first()
    if ad is None:
        return False
    r = R.get_redis()
    if not r.set(K.ad_dedupe("click", impression_id), 1, nx=True, ex=86400):
        return False  # un clic par impression
    s = ad.ad_set
    cost = s.bid_minor * MICRO if s.billing_model == "cpc" else 0
    if cost and not reserve_budget(s.campaign, cost):
        r.delete(K.ad_dedupe("click", impression_id))
        return False
    _accumulate(ad, clicks=1, spend_micro=cost)
    _event("click", f"click:{impression_id}", ad, user.pk, ip_hash=_hash_ip(ip))
    return True


def record_conversion(impression_id: str, user) -> bool:
    click = collection(EVENTS).find_one({"_id": f"click:{impression_id}"})
    if click is None or click["user_id"] != str(user.pk):
        return False
    ts = click["ts"] if click["ts"].tzinfo else click["ts"].replace(tzinfo=dt_tz.utc)
    if timezone.now() - ts > CONVERSION_WINDOW:
        return False
    if not R.get_redis().set(K.ad_dedupe("conv", impression_id), 1, nx=True, ex=CONVERSION_WINDOW.seconds + CONVERSION_WINDOW.days * 86400):
        return False
    ad = Advertisement.objects.select_related("ad_set__campaign").get(pk=click["ad_id"])
    _accumulate(ad, conversions=1)
    _event("conversion", f"conv:{impression_id}", ad, user.pk)
    return True


# ------------------------------------------------------------------ reglement (verite financiere)
def _parse_key(key: str) -> tuple[str, str, str]:
    batch, ad, day = key.rsplit(":", 3)[-3:]
    return batch, ad, day


def settle() -> dict:
    """Deplace atomiquement (RENAME) les accumulateurs vers un lot, puis l'applique en base. Un plantage entre les deux laisse le lot
    en attente : `recover_settlements` le rejoue sans doublon (unicite du lot + reference du journal)."""
    r = R.get_redis()
    batch = uuid.uuid4().hex
    moved = 0
    for key in r.scan_iter(match=K.ad_acc("*", "*"), count=500):
        ad_id, day = key.rsplit(":", 2)[-2:]
        try:
            r.rename(key, K.ad_settling(batch, ad_id, day))
            moved += 1
        except Exception:  # noqa: BLE001 - cle deja regl\u00e9e par un autre worker entre le SCAN et le RENAME
            continue
    applied = _apply_pending(only_batch=batch) if moved else 0
    return {"batch": batch, "ads": moved, "applied": applied}


def recover_settlements() -> int:
    """Rejoue les lots restes en attente (apres un plantage). Idempotent."""
    return _apply_pending(only_batch=None)


def _apply_pending(only_batch: str | None) -> int:
    r = R.get_redis()
    groups: dict[str, list] = {}
    for key in r.scan_iter(match=K.ad_settling(only_batch or "*", "*", "*"), count=500):
        batch, ad_id, day = _parse_key(key)
        h = r.hgetall(key)
        groups.setdefault(batch, []).append((key, ad_id, day, int(h.get("impressions", 0)), int(h.get("clicks", 0)), int(h.get("conversions", 0)), int(h.get("spend_micro", 0))))
    n = 0
    for batch, rows in groups.items():
        _apply_batch(batch, rows)
        for key, *_ in rows:
            r.delete(key)  # supprime APRES le commit : un plantage avant cette ligne est rattrape par recover_settlements
        n += len(rows)
    return n


@transaction.atomic
def _apply_batch(batch: str, rows: list) -> None:
    by_account: dict = {}
    for _key, ad_id, day, imp, clk, conv, spend in rows:
        ad = Advertisement.objects.select_related("ad_set__campaign__account").get(pk=ad_id)
        _, created = AdSettlement.objects.get_or_create(batch=uuid.UUID(batch), ad=ad, day=day, defaults={"impressions": imp, "clicks": clk, "conversions": conv, "spend_micro": spend})
        if created:
            by_account.setdefault(ad.ad_set.campaign.account_id, []).append((ad.ad_set.campaign_id, spend))
    for account_id, items in by_account.items():
        account = AdAccount.objects.select_for_update().get(pk=account_id)
        total = account.spend_remainder_micro + sum(s for _, s in items)
        minor, account.spend_remainder_micro = divmod(total, MICRO)
        debit = min(minor, account.balance_minor)
        if debit > 0:
            account.balance_minor -= debit
            AdAccountTransaction.objects.create(account=account, kind="spend", amount_minor=-debit, balance_after_minor=account.balance_minor, reference=f"settle:{batch}")
        account.save(update_fields=["balance_minor", "spend_remainder_micro", "updated_at"])
        if debit < minor or account.balance_minor == 0:  # fonds epuises : on stoppe TOUTES les campagnes du compte (jamais de dette)
            Campaign.objects.filter(account=account, status="active").update(status="paused", pause_reason="out_of_funds", updated_at=timezone.now())
            publish_event("AdAccountOutOfFunds", "ad_account", account.pk, {"shortfall_minor": max(minor - debit, 0)})
        for campaign_id in {c for c, _ in items}:
            campaign = Campaign.objects.get(pk=campaign_id)
            if _settled_micro(campaign_id) >= campaign.total_budget_minor * MICRO and campaign.status == "active":
                Campaign.objects.filter(pk=campaign_id).update(status="completed", pause_reason="budget_exhausted", updated_at=timezone.now())
