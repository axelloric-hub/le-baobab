from rest_framework import serializers

from apps.portfolio.models import Education, Experience, Project, ProjectLink


class ProjectLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectLink
        fields = ("kind", "provider", "url")


class ProjectSerializer(serializers.ModelSerializer):
    links = ProjectLinkSerializer(many=True, read_only=True)
    technologies = serializers.SlugRelatedField(many=True, read_only=True, slug_field="slug")

    class Meta:
        model = Project
        fields = ("id", "slug", "title", "description", "role", "started_on", "ended_on", "is_featured", "technologies", "links")
        read_only_fields = ("id", "technologies", "links")


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = ("id", "company_name", "title", "location", "started_on", "ended_on", "description")

    def validate(self, attrs):
        if attrs.get("ended_on") and attrs["ended_on"] < attrs["started_on"]:
            raise serializers.ValidationError({"ended_on": "La fin precede le debut."})
        return attrs


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = ("id", "institution", "degree", "field", "started_on", "ended_on")
