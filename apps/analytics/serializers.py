from rest_framework import serializers

from apps.analytics.models import DailyMetric, EventType


class EventTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventType
        fields = ("code", "domain", "description", "actor_required", "retention_days")
        read_only_fields = fields


class DailyMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyMetric
        fields = ("day", "metric", "dimension", "value")
        read_only_fields = fields
