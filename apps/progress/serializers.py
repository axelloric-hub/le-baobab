from rest_framework import serializers

from apps.progress.models import Certificate, ChapterProgress


class ProgressInputSerializer(serializers.Serializer):
    percent = serializers.IntegerField(min_value=0, max_value=100)
    seconds = serializers.IntegerField(min_value=0, max_value=3600, default=0)


class ChapterProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterProgress
        fields = ("chapter", "status", "percent", "time_spent_seconds", "completed_at")
        read_only_fields = fields


class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Certificate
        fields = ("id", "course", "course_title", "verification_code", "score_percent", "issued_at", "revoked_at")
        read_only_fields = fields


class CertificateVerificationSerializer(serializers.Serializer):
    """Reponse PUBLIQUE de verification : aucune donnee privee."""

    valid = serializers.BooleanField()
    holder = serializers.CharField(required=False)
    course = serializers.CharField(required=False)
    issued_at = serializers.CharField(required=False)
    score_percent = serializers.FloatField(required=False, allow_null=True)
