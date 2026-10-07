from rest_framework import serializers

from apps.audit.models import AdminAction, AuditLog, SecurityEvent


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ("id", "actor", "actor_label", "action", "object_type", "object_id", "old_values", "new_values", "source", "ip_address", "correlation_id", "created_at")
        read_only_fields = fields


class AdminActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminAction
        fields = ("id", "admin", "action", "target_type", "target_id", "reason", "payload", "created_at")
        read_only_fields = fields


class SecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEvent
        fields = ("id", "user", "event_type", "severity", "ip_address", "data", "created_at")
        read_only_fields = fields
