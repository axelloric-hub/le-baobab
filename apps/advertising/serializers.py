from rest_framework import serializers

from apps.advertising.models import Advertisement, Campaign


class AdDeliverySerializer(serializers.ModelSerializer):
    """Ce que le CLIENT recoit pour afficher une annonce : creation et destination. JAMAIS enchere, budget, ciblage ni compte annonceur."""

    headline = serializers.CharField(source="creative.headline", read_only=True)
    body = serializers.CharField(source="creative.body", read_only=True)
    media_key = serializers.CharField(source="creative.media_key", read_only=True)
    cta_label = serializers.CharField(source="creative.cta_label", read_only=True)
    destination_url = serializers.CharField(source="creative.destination_url", read_only=True)

    class Meta:
        model = Advertisement
        fields = ("id", "headline", "body", "media_key", "cta_label", "destination_url")
        read_only_fields = fields


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = ("id", "name", "objective", "status", "pause_reason", "starts_at", "ends_at", "daily_budget_minor", "total_budget_minor")
        read_only_fields = ("id", "status", "pause_reason")


class ImpressionReportSerializer(serializers.Serializer):
    ad = serializers.UUIDField()
    placement = serializers.CharField(max_length=12)
    impression_id = serializers.CharField(max_length=64)


class PersonalizationSerializer(serializers.Serializer):
    personalized_ads = serializers.BooleanField()
