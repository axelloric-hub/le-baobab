from rest_framework import serializers

from apps.jobs.models import Job, JobApplication, Proposal


class JobPublicSerializer(serializers.ModelSerializer):
    skills = serializers.SlugRelatedField(many=True, read_only=True, slug_field="slug")
    company_name = serializers.CharField(source="company.name", read_only=True, default=None)

    class Meta:
        model = Job
        fields = ("id", "title", "description", "company_name", "job_type", "contract_type", "experience_level", "remote_policy", "city", "salary_min_minor",
                  "salary_max_minor", "salary_currency", "salary_period", "skills", "published_at", "deadline")
        read_only_fields = fields


class ApplyInputSerializer(serializers.Serializer):
    cover_letter = serializers.CharField(max_length=10000, required=False, allow_blank=True, default="")
    cv_storage_key = serializers.CharField(max_length=400, required=False, allow_blank=True, default="")
    portfolio_url = serializers.URLField(required=False, allow_blank=True, default="")
    github_url = serializers.URLField(required=False, allow_blank=True, default="")
    gitlab_url = serializers.URLField(required=False, allow_blank=True, default="")
    projects = serializers.ListField(child=serializers.UUIDField(), required=False, max_length=10)


class ApplicationSerializer(serializers.ModelSerializer):
    """Vue du CANDIDAT sur sa candidature."""

    class Meta:
        model = JobApplication
        fields = ("id", "job", "status", "cover_letter", "portfolio_url", "github_url", "gitlab_url", "created_at")
        read_only_fields = fields


class TransitionSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=JobApplication.Status.choices)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class ProposalInputSerializer(serializers.Serializer):
    cover_letter = serializers.CharField(max_length=10000)
    bid_minor = serializers.IntegerField(min_value=1)
    currency = serializers.CharField(max_length=3)
    delivery_days = serializers.IntegerField(min_value=1, max_value=3650)


class ProposalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proposal
        fields = ("id", "job", "bid_minor", "currency", "delivery_days", "status", "created_at")
        read_only_fields = fields
