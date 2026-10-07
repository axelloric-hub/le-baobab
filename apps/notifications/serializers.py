from rest_framework import serializers

from apps.notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="type_id", read_only=True)
    actor_username = serializers.CharField(source="actor.username", read_only=True, default=None)

    class Meta:
        model = Notification
        fields = ("id", "type", "actor", "actor_username", "target_type", "target_id", "data", "seen_at", "read_at", "created_at")
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ("id", "type", "channel", "enabled", "quiet_hours_start", "quiet_hours_end")
