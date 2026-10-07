from rest_framework import serializers

from apps.education.models import Chapter, Classroom, ContentBlock, Course, Enrollment, Module


class ClassroomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = ("id", "slug", "title", "description", "privacy", "is_paid", "price_minor", "currency", "created_at")
        read_only_fields = ("id", "created_at")


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ("id", "classroom", "slug", "title", "description", "level", "language", "status", "is_free", "price_minor", "currency",
                  "certificate_enabled", "published_at")
        read_only_fields = ("id", "status", "published_at")


class ChapterOutlineSerializer(serializers.ModelSerializer):
    """Plan du cours : titres et PRIX, jamais le contenu (ni cles de stockage). Le contenu passe par ContentBlockSerializer, apres access_decision."""

    class Meta:
        model = Chapter
        fields = ("id", "position", "title", "estimated_minutes", "is_free", "price_minor", "currency")
        read_only_fields = fields


class ModuleOutlineSerializer(serializers.ModelSerializer):
    chapters = ChapterOutlineSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ("id", "position", "title", "description", "is_free", "price_minor", "currency", "chapters")
        read_only_fields = fields


class ContentBlockSerializer(serializers.ModelSerializer):
    """A n'utiliser QU'APRES un access_decision() favorable."""

    class Meta:
        model = ContentBlock
        fields = ("id", "position", "kind", "title", "body", "storage_key", "url", "ref_id", "payload", "duration_seconds")
        read_only_fields = fields


class EnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = ("id", "course", "status", "enrolled_at", "completed_at")
        read_only_fields = fields


class AccessDecisionSerializer(serializers.Serializer):
    allowed = serializers.BooleanField()
    reason = serializers.CharField()
