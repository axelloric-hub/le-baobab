from django.contrib import admin

from apps.advertising.models import (
    AdAccount, AdAccountTransaction, Advertisement, Advertiser, AdSet, AdSettlement, AdUserPreference, Audience, AudienceMembership, Campaign, Creative, TargetingRule,
)
from apps.core.admin_utils import register_readable


class RuleInline(admin.TabularInline):
    model = TargetingRule
    extra = 0


@admin.register(AdSet)
class AdSetAdmin(admin.ModelAdmin):
    list_display = ("name", "campaign", "billing_model", "bid_minor", "frequency_cap_per_day", "status")
    list_filter = ("billing_model", "status")
    raw_id_fields = ("campaign", "audience")
    inlines = [RuleInline]


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    """File de moderation : `pending_review` d'abord. La validation passe par le service (trace, evenement), pas par l'edition libre."""

    list_display = ("id", "creative", "status", "reviewed_by", "reviewed_at")
    list_filter = ("status",)
    raw_id_fields = ("ad_set", "creative", "reviewed_by")
    ordering = ("status", "-reviewed_at")


for _m in (AdAccount, AdAccountTransaction, AdSettlement):
    # Portefeuille, journal et reglements : LECTURE SEULE (verite financiere).
    register_readable(_m, readonly=[f.name for f in _m._meta.fields], allow_add=False, allow_delete=False)
register_readable(Advertiser, search=("name", "owner__username"), filters=("status",))
register_readable(Campaign, search=("name",), filters=("status", "objective"), readonly=("pause_reason",))
register_readable(Creative, search=("headline",), filters=("kind",))
register_readable(Audience, search=("name",))
register_readable(AudienceMembership)
register_readable(AdUserPreference, filters=("personalized_ads",))
