"""Publicite. REPARTITION DES VERITES :
 - PostgreSQL : annonceurs, campagnes, budgets, portefeuille prepaye, REGLEMENTS de depenses (verite financiere) ;
 - Redis      : plafonds de frequence, garde-fous de budget en temps reel, accumulateurs a regler (reconstructibles/approximatifs) ;
 - MongoDB    : evenements bruts (impressions, clics, conversions) a fort volume, TTL.
Montants en entiers ; la depense en MICRO-unites (1e-6 de la plus petite unite) pour que le CPM par impression ne perde aucun centime.
Ciblage : LISTE BLANCHE de criteres (CHECK en base) : aucune donnee sensible ne peut etre utilisee, meme par un client malveillant."""
from __future__ import annotations

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL
MICRO = 1_000_000
TARGETING_FIELDS = ("interest", "skill", "technology", "profession", "country", "region", "language", "level", "domain", "availability", "followed_category", "viewed_content_type")
PLACEMENTS = ("feed", "sidebar", "search", "course_page", "job_page")


class Advertiser(UUIDModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        SUSPENDED = "suspended", "Suspendu"

    owner = models.ForeignKey(U, on_delete=models.PROTECT, related_name="advertisers")
    company_ref = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=140)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "advertising_advertiser"
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_advertiser_name")]


class AdAccount(UUIDModel):
    """Portefeuille PREPAYE : le solde ne peut JAMAIS etre negatif (CHECK) => aucune depense sans fonds."""

    advertiser = models.OneToOneField(Advertiser, on_delete=models.PROTECT, related_name="account")
    currency = models.CharField(max_length=3)
    balance_minor = models.BigIntegerField(default=0)
    spend_remainder_micro = models.PositiveIntegerField(default=0)  # reste (< 1e6) du dernier reglement
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "advertising_account"
        constraints = [models.CheckConstraint(condition=Q(balance_minor__gte=0), name="chk_adaccount_no_overdraft"),
                       models.CheckConstraint(condition=~Q(currency=""), name="chk_adaccount_currency"),
                       models.CheckConstraint(condition=Q(spend_remainder_micro__lt=1_000_000), name="chk_adaccount_remainder")]


class AdAccountTransaction(models.Model):
    """Journal du portefeuille (ecriture seule, trigger). `reference` UNIQUE par compte => recharge/reglement idempotents."""

    class Kind(models.TextChoices):
        TOPUP = "topup", "Recharge"
        SPEND = "spend", "Depense"
        REFUND = "refund", "Remboursement"

    id = models.BigAutoField(primary_key=True)
    account = models.ForeignKey(AdAccount, on_delete=models.PROTECT, related_name="transactions")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    amount_minor = models.BigIntegerField()  # signe : recharge > 0, depense < 0
    balance_after_minor = models.BigIntegerField()
    reference = models.CharField(max_length=120)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "advertising_account_transaction"
        constraints = [models.UniqueConstraint(fields=["account", "reference"], name="uniq_adtx_reference"),
                       models.CheckConstraint(condition=~Q(amount_minor=0), name="chk_adtx_nonzero"),
                       models.CheckConstraint(condition=Q(kind="spend", amount_minor__lt=0) | ~Q(kind="spend") & Q(amount_minor__gt=0), name="chk_adtx_sign")]
        indexes = [models.Index(fields=["account", "-created_at"], name="adtx_account_idx")]


class Audience(UUIDModel):
    class Kind(models.TextChoices):
        CUSTOM_LIST = "custom_list", "Liste personnalisee"
        RULE_BASED = "rule_based", "Par regles"

    advertiser = models.ForeignKey(Advertiser, on_delete=models.CASCADE, related_name="audiences")
    name = models.CharField(max_length=140)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.CUSTOM_LIST)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "advertising_audience"
        constraints = [models.UniqueConstraint(fields=["advertiser", "name"], name="uniq_audience_name")]


class AudienceMembership(models.Model):
    id = models.BigAutoField(primary_key=True)
    audience = models.ForeignKey(Audience, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    source = models.CharField(max_length=30, default="advertiser_list")
    added_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "advertising_audience_membership"
        constraints = [models.UniqueConstraint(fields=["audience", "user"], name="uniq_audience_member")]
        indexes = [models.Index(fields=["user"], name="audmember_user_idx")]


class Campaign(UUIDModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "En pause"
        COMPLETED = "completed", "Terminee"

    class Objective(models.TextChoices):
        AWARENESS = "awareness", "Notoriete"
        TRAFFIC = "traffic", "Trafic"
        CONVERSIONS = "conversions", "Conversions"

    account = models.ForeignKey(AdAccount, on_delete=models.PROTECT, related_name="campaigns")
    name = models.CharField(max_length=140)
    objective = models.CharField(max_length=12, choices=Objective.choices, default=Objective.TRAFFIC)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    pause_reason = models.CharField(max_length=40, blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    daily_budget_minor = models.PositiveBigIntegerField()
    total_budget_minor = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "advertising_campaign"
        constraints = [models.CheckConstraint(condition=Q(daily_budget_minor__gt=0) & Q(total_budget_minor__gte=models.F("daily_budget_minor")), name="chk_campaign_budgets"),
                       models.CheckConstraint(condition=Q(ends_at__isnull=True) | Q(ends_at__gt=models.F("starts_at")), name="chk_campaign_period")]
        indexes = [models.Index(fields=["starts_at"], name="campaign_active_idx", condition=Q(status="active"))]


class AdSet(UUIDModel):
    class Billing(models.TextChoices):
        CPC = "cpc", "Au clic"
        CPM = "cpm", "Aux 1000 impressions"

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        PAUSED = "paused", "En pause"

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="ad_sets")
    name = models.CharField(max_length=140)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    billing_model = models.CharField(max_length=3, choices=Billing.choices, default=Billing.CPC)
    bid_minor = models.PositiveIntegerField()  # par clic (CPC) ou par 1000 impressions (CPM)
    placements = ArrayField(models.CharField(max_length=12), default=list)
    frequency_cap_per_day = models.PositiveSmallIntegerField(default=3)  # impressions max par utilisateur et par jour
    audience = models.ForeignKey(Audience, null=True, blank=True, on_delete=models.SET_NULL, related_name="ad_sets")

    class Meta:
        db_table = "advertising_adset"
        constraints = [models.CheckConstraint(condition=Q(bid_minor__gt=0), name="chk_adset_bid"),
                       models.CheckConstraint(condition=Q(frequency_cap_per_day__gte=1, frequency_cap_per_day__lte=50), name="chk_adset_freqcap")]


class TargetingRule(UUIDModel):
    """Une regle = (critere, operateur, valeurs). ET entre regles ; dans une regle : `in` = OU, `all` = ET, `not_in` = NON.
    Ex. 'Python OU Django OU ML' = skill IN [..] ; 'JavaScript ET Cameroun ET freelance' = trois regles. `required=False` : critere souple (ponderation)."""

    class Operator(models.TextChoices):
        IN = "in", "Parmi (OU)"
        ALL = "all", "Tous (ET)"
        NOT_IN = "not_in", "Aucun de (NON)"

    ad_set = models.ForeignKey(AdSet, on_delete=models.CASCADE, related_name="rules")
    field = models.CharField(max_length=24)
    operator = models.CharField(max_length=6, choices=Operator.choices, default=Operator.IN)
    values = models.JSONField(default=list)
    required = models.BooleanField(default=True)
    weight = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = "advertising_targeting_rule"
        constraints = [  # LISTE BLANCHE : aucune donnee sensible (sante, religion, origine, orientation...) ne peut etre ciblee
            models.CheckConstraint(condition=Q(field__in=list(TARGETING_FIELDS)), name="chk_targeting_field_allowed"),
            models.CheckConstraint(condition=Q(weight__gte=1, weight__lte=10), name="chk_targeting_weight"),
        ]


class Creative(UUIDModel):
    class Kind(models.TextChoices):
        TEXT = "text", "Texte"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    advertiser = models.ForeignKey(Advertiser, on_delete=models.CASCADE, related_name="creatives")
    kind = models.CharField(max_length=6, choices=Kind.choices, default=Kind.TEXT)
    headline = models.CharField(max_length=90)
    body = models.CharField(max_length=300, blank=True)
    media_key = models.CharField(max_length=400, blank=True)
    cta_label = models.CharField(max_length=30, blank=True)
    destination_url = models.URLField(max_length=500)

    class Meta:
        db_table = "advertising_creative"
        constraints = [models.CheckConstraint(condition=Q(destination_url__startswith="https://"), name="chk_creative_https"),
                       models.CheckConstraint(condition=Q(kind="text") | ~Q(media_key=""), name="chk_creative_media")]


class Advertisement(UUIDModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PENDING_REVIEW = "pending_review", "En moderation"
        ACTIVE = "active", "Diffusee"
        PAUSED = "paused", "En pause"
        REJECTED = "rejected", "Refusee"

    ad_set = models.ForeignKey(AdSet, on_delete=models.CASCADE, related_name="ads")
    creative = models.ForeignKey(Creative, on_delete=models.PROTECT, related_name="ads")
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.DRAFT)
    review_notes = models.CharField(max_length=500, blank=True)
    reviewed_by = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "advertising_ad"
        constraints = [models.CheckConstraint(condition=~Q(status__in=["active", "rejected"]) | Q(reviewed_at__isnull=False), name="chk_ad_reviewed")]  # rien ne diffuse sans validation
        indexes = [models.Index(fields=["ad_set"], name="ad_live_idx", condition=Q(status="active"))]


class AdSettlement(models.Model):
    """REGLEMENT : lot de depenses/statistiques d'UNE annonce pour UN jour, applique UNE seule fois (unique(batch, ad)). Verite financiere."""

    id = models.BigAutoField(primary_key=True)
    batch = models.UUIDField()
    ad = models.ForeignKey(Advertisement, on_delete=models.PROTECT, related_name="settlements")
    day = models.DateField()
    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)
    spend_micro = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "advertising_settlement"
        # Pas de contrainte clics <= impressions : un clic peut arriver le lendemain de l'impression (compteurs par jour).
        constraints = [models.UniqueConstraint(fields=["batch", "ad", "day"], name="uniq_settlement")]
        indexes = [models.Index(fields=["ad", "day"], name="settlement_ad_day_idx")]


class AdUserPreference(models.Model):
    """Droit de refuser la publicite PERSONNALISEE : l'utilisateur ne recoit alors que des annonces sans ciblage personnel."""

    user = models.OneToOneField(U, primary_key=True, on_delete=models.CASCADE, related_name="ad_preference")
    personalized_ads = models.BooleanField(default=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "advertising_user_preference"
