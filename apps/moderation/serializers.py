from rest_framework import serializers

from apps.moderation.models import ModerationAction, ModerationCase, Report, ReportReason


class ReportReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportReason
        fields = ("code", "label", "severity")


class ReportCreateSerializer(serializers.Serializer):
    target_type = serializers.CharField(max_length=40)
    target_id = serializers.UUIDField()
    reason = serializers.SlugRelatedField(slug_field="code", queryset=ReportReason.objects.filter(is_active=True))
    details = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ("id", "target_type", "target_id", "reason", "details", "status", "created_at")
        read_only_fields = fields


class ModerationCaseSerializer(serializers.ModelSerializer):
    report_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = ModerationCase
        fields = ("id", "subject_type", "subject_id", "status", "priority", "assignee", "opened_at", "resolved_at", "resolution", "report_count")
        read_only_fields = fields


class ModerationActionInputSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ModerationAction.Type.choices)
    reason = serializers.CharField(max_length=1000)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    policy_code = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    points = serializers.IntegerField(min_value=1, max_value=5, default=1)
