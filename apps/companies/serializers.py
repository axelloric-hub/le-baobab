from rest_framework import serializers

from apps.companies.models import Company, CompanyMember


class CompanyPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ("id", "slug", "name", "tagline", "description", "website", "industry", "size_range", "city", "logo_key", "cover_key", "status")
        read_only_fields = fields


class CompanyWriteSerializer(serializers.ModelSerializer):
    """Liste blanche : `status` (verification) n'est jamais modifiable par le client."""

    class Meta:
        model = Company
        fields = ("slug", "name", "tagline", "description", "website", "industry", "size_range", "country", "city", "logo_key", "cover_key")


class CompanyMemberPublicSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CompanyMember
        fields = ("username", "title", "role")
        read_only_fields = fields
