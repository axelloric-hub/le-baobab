"""Publicite : compte annonceur et campagnes (isolation stricte par proprietaire), validation humaine, diffusion (selection, impression, clic, conversion), preferences de personnalisation."""
from __future__ import annotations

import uuid

from django.db import connection
from rest_framework import serializers as s
from rest_framework.response import Response

from apps.advertising import delivery as D
from apps.advertising import services as A
from apps.advertising.models import AdAccount, Advertisement, AdSet, AdUserPreference, Audience, Campaign, Creative, PLACEMENTS, TARGETING_FIELDS
from apps.advertising.serializers import AdDeliverySerializer
from apps.core.api import client_ip, endpoint, get_or_404, paginate
from apps.profiles.selectors import get_active_or_404 as _u
from apps.storage.services import resolve_owned, signed_url


def _account(request, account_id) -> AdAccount:
    return get_or_404(AdAccount.objects.filter(pk=account_id, advertiser__owner=request.user).select_related("advertiser"))


def _campaign(request, campaign_id) -> Campaign:
    return get_or_404(Campaign.objects.filter(pk=campaign_id, account__advertiser__owner=request.user).select_related("account__advertiser"))


def _acct_json(a: AdAccount) -> dict:
    return {"id": str(a.pk), "advertiser": a.advertiser.name, "currency": a.currency, "balance_minor": a.balance_minor}


def _camp_json(c: Campaign) -> dict:
    return {"id": str(c.pk), "account": str(c.account_id), "name": c.name, "objective": c.objective, "status": c.status, "pause_reason": c.pause_reason, "starts_at": c.starts_at, "ends_at": c.ends_at,
            "daily_budget_minor": c.daily_budget_minor, "total_budget_minor": c.total_budget_minor}


@endpoint("Creer mon compte annonceur et son portefeuille prepaye.", status=201, body={"name": s.CharField(max_length=140), "currency": s.CharField(min_length=3, max_length=3)})
def create_account(request):
    return _acct_json(A.create_advertiser(request.user, name=request.input["name"], currency=request.input["currency"]))


@endpoint("Mes comptes annonceur.")
def my_accounts(request):
    return [_acct_json(a) for a in AdAccount.objects.filter(advertiser__owner=request.user).select_related("advertiser")]


@endpoint("[Administration] Crediter un portefeuille (virement verifie). reference unique : un rejeu ne credite pas deux fois.", auth="staff", status=201, body={"amount_minor": s.IntegerField(min_value=1), "reference": s.CharField(max_length=120)})
def admin_topup(request, account_id):
    acct = get_or_404(AdAccount.objects.filter(pk=account_id).select_related("advertiser"))
    tx, created = A.top_up(acct.pk, request.user, amount_minor=request.input["amount_minor"], reference=request.input["reference"])
    return {"credited": created, "balance_after_minor": tx.balance_after_minor}


@endpoint("Creer une campagne (brouillon).", status=201, body={"account": s.UUIDField(), "name": s.CharField(max_length=140), "starts_at": s.DateTimeField(), "ends_at": s.DateTimeField(required=False),
                                                              "daily_budget_minor": s.IntegerField(min_value=1), "total_budget_minor": s.IntegerField(min_value=1), "objective": s.ChoiceField(choices=["awareness", "traffic", "conversions"], default="traffic")})
def create_campaign(request):
    d = dict(request.input)
    return _camp_json(A.create_campaign(_account(request, d.pop("account")), request.user, **d))


@endpoint("Mes campagnes.")
def my_campaigns(request):
    return paginate(request, Campaign.objects.filter(account__advertiser__owner=request.user), ("-created_at", "-id"), _camp_json, 20)


class _RuleIn(s.Serializer):
    field = s.ChoiceField(choices=list(TARGETING_FIELDS))
    operator = s.ChoiceField(choices=["in", "all", "not_in"], default="in")
    values = s.ListField(child=s.CharField(max_length=80), min_length=1, max_length=50)
    required = s.BooleanField(default=True)
    weight = s.IntegerField(min_value=1, max_value=10, default=1)


@endpoint("Creer un groupe d'annonces. Ciblage = regles ET entre elles (in = OU, all = ET, not_in = NON) ; criteres limites a une liste blanche, AUCUNE donnee sensible. frequency_cap_per_day : impressions max par utilisateur et par jour.", status=201,
          body={"name": s.CharField(max_length=140), "bid_minor": s.IntegerField(min_value=1), "billing_model": s.ChoiceField(choices=["cpc", "cpm"], default="cpc"), "placements": s.ListField(child=s.ChoiceField(choices=list(PLACEMENTS)), min_length=1),
                "frequency_cap_per_day": s.IntegerField(min_value=1, max_value=50, default=3), "audience": s.UUIDField(required=False), "rules": s.ListField(child=_RuleIn(), required=False, max_length=20)})
def create_ad_set(request, campaign_id):
    d = request.input
    aud = get_or_404(Audience.objects.filter(pk=d["audience"], advertiser__owner=request.user)) if d.get("audience") else None
    st = A.create_ad_set(_campaign(request, campaign_id), request.user, name=d["name"], bid_minor=d["bid_minor"], placements=d["placements"], billing_model=d["billing_model"],
                         frequency_cap_per_day=d["frequency_cap_per_day"], audience=aud, rules=[dict(r) for r in d.get("rules", [])])
    return {"id": str(st.pk)}


@endpoint("Creer une creation publicitaire (https obligatoire ; image/video : fichier envoye, usage 'ad_creative').", status=201,
          body={"account": s.UUIDField(), "headline": s.CharField(max_length=90), "destination_url": s.URLField(max_length=500), "kind": s.ChoiceField(choices=["text", "image", "video"], default="text"), "body": s.CharField(max_length=300, required=False, allow_blank=True, default=""),
                "cta_label": s.CharField(max_length=30, required=False, allow_blank=True, default=""), "file": s.UUIDField(required=False)})
def create_creative(request):
    d = request.input
    acct = _account(request, d["account"])
    key = resolve_owned(request.user, d["file"], ("ad_creative",)).key if d.get("file") else ""
    c = A.create_creative(acct.advertiser, request.user, headline=d["headline"], destination_url=d["destination_url"], kind=d["kind"], body=d["body"], media_key=key, cta_label=d["cta_label"])
    return {"id": str(c.pk)}


@endpoint("Creer une annonce (creation + groupe d'annonces).", status=201, body={"creative": s.UUIDField()})
def create_ad(request, ad_set_id):
    st = get_or_404(AdSet.objects.filter(pk=ad_set_id, campaign__account__advertiser__owner=request.user).select_related("campaign__account__advertiser"))
    cr = get_or_404(Creative.objects.filter(pk=request.input["creative"], advertiser__owner=request.user))
    return {"id": str(A.create_ad(st, cr, request.user).pk)}


@endpoint("Soumettre l'annonce a la moderation (aucune annonce ne diffuse sans validation humaine).")
def submit_ad(request, ad_id):
    ad = get_or_404(Advertisement.objects.filter(pk=ad_id, ad_set__campaign__account__advertiser__owner=request.user).select_related("ad_set__campaign__account__advertiser"))
    return {"status": A.submit_for_review(ad, request.user).status}


@endpoint("[Moderation] File des annonces a valider.", auth="staff")
def review_queue(request):
    return paginate(request, Advertisement.objects.filter(status="pending_review").select_related("creative"), ("id",),
                    lambda a: {"id": str(a.pk), "headline": a.creative.headline, "body": a.creative.body, "destination_url": a.creative.destination_url, "kind": a.creative.kind}, 30)


@endpoint("[Moderation] Valider ou refuser une annonce.", auth="staff", body={"approve": s.BooleanField(), "notes": s.CharField(max_length=500, required=False, allow_blank=True, default="")})
def review_ad(request, ad_id):
    return {"status": A.review_ad(ad_id, request.user, approve=request.input["approve"], notes=request.input["notes"]).status}


@endpoint("Activer la campagne (portefeuille non vide et au moins une annonce validee).")
def activate(request, campaign_id):
    return _camp_json(A.activate_campaign(_campaign(request, campaign_id), request.user))


@endpoint("Mettre la campagne en pause.")
def pause(request, campaign_id):
    return _camp_json(A.pause_campaign(_campaign(request, campaign_id), request.user))


@endpoint("Statistiques d'une campagne (depense reglee, impressions, clics, CTR, budget restant) et solde du portefeuille.")
def stats(request, campaign_id):
    c = _campaign(request, campaign_id)
    with connection.cursor() as cur:
        cur.execute("SELECT impressions, clicks, conversions, spend_minor, ctr_percent, remaining_budget_minor FROM v_campaign_statistics WHERE campaign_id = %s", [c.pk])
        i, k, v, sp, ctr, rem = cur.fetchone()
    return {"impressions": int(i), "clicks": int(k), "conversions": int(v), "spend_minor": float(sp), "ctr_percent": float(ctr), "remaining_budget_minor": float(rem), "wallet_balance_minor": AdAccount.objects.get(pk=c.account_id).balance_minor}


@endpoint("Creer une audience personnalisee.", status=201, body={"account": s.UUIDField(), "name": s.CharField(max_length=140)})
def create_audience(request):
    acct = _account(request, request.input["account"])
    a = Audience.objects.create(advertiser=acct.advertiser, name=request.input["name"])
    return {"id": str(a.pk), "name": a.name}


@endpoint("Ajouter des utilisateurs (pseudos) a une de mes audiences.", status=201, body={"usernames": s.ListField(child=s.CharField(max_length=30), min_length=1, max_length=500)})
def audience_members(request, audience_id):
    aud = get_or_404(Audience.objects.filter(pk=audience_id, advertiser__owner=request.user).select_related("advertiser"))
    return {"added": A.add_to_audience(aud, request.user, [_u(n) for n in request.input["usernames"]])}


# ------------------------------------------------------------------ diffusion (cote application)
@endpoint("Annonces a afficher a cet emplacement (classees par valeur, respect du ciblage, du plafond de frequence et des budgets). Chaque annonce porte un impression_id a rapporter via /ads/impressions/.",
          query={"placement": s.ChoiceField(choices=list(PLACEMENTS)), "limit": s.IntegerField(min_value=1, max_value=5, default=1)})
def serve(request):
    ads = D.select_ads(request.user, request.q["placement"], limit=request.q["limit"])
    return [{**AdDeliverySerializer(a).data, "media_url": signed_url(a.creative.media_key) if a.creative.media_key else None, "impression_id": uuid.uuid4().hex} for a in ads]


@endpoint("Rapporter qu'une annonce a ete AFFICHEE (compte une seule fois par impression_id ; plafond de frequence et budget appliques).", status=202,
          body={"ad": s.UUIDField(), "placement": s.ChoiceField(choices=list(PLACEMENTS)), "impression_id": s.CharField(max_length=64)})
def impression(request):
    d = request.input
    return {"counted": D.record_impression(d["ad"], request.user, d["placement"], d["impression_id"])}


@endpoint("Rapporter un CLIC (une impression connue, du meme utilisateur, de moins de 24 h ; un clic par impression). Renvoie l'URL de destination.", body={"impression_id": s.CharField(max_length=64)})
def click(request):
    counted = D.record_click(request.input["impression_id"], request.user, ip=client_ip(request))
    dest = None
    if counted:
        from apps.core.mongo import collection

        ev = collection(D.EVENTS).find_one({"_id": f"imp:{request.input['impression_id']}"})
        dest = Advertisement.objects.filter(pk=ev["ad_id"]).values_list("creative__destination_url", flat=True).first() if ev else None
    return {"counted": counted, "destination_url": dest}


@endpoint("Rapporter une CONVERSION attribuee a un clic (fenetre de 7 jours, une par clic).", status=202, body={"impression_id": s.CharField(max_length=64)})
def conversion(request):
    return {"counted": D.record_conversion(request.input["impression_id"], request.user)}


@endpoint("Mes preferences publicitaires.")
def get_preferences(request):
    p = AdUserPreference.objects.filter(user=request.user).first()
    return {"personalized_ads": p.personalized_ads if p else True}


@endpoint("Accepter ou refuser la publicite personnalisee (refus : seules des annonces SANS ciblage personnel vous sont montrees).", body={"personalized_ads": s.BooleanField()})
def set_preferences(request):
    return {"personalized_ads": A.set_personalization(request.user, request.input["personalized_ads"]).personalized_ads}
