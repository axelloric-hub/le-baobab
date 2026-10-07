from rest_framework import serializers

from apps.integrations.models import EmbedMetadata, ExternalAccount, ExternalAuthor, ExternalContent


class ExternalAccountSerializer(serializers.ModelSerializer):
    """Ne renvoie JAMAIS les tokens."""

    provider = serializers.CharField(source="provider_id", read_only=True)

    class Meta:
        model = ExternalAccount
        fields = ("id", "provider", "handle", "scopes", "connected_at", "revoked_at")
        read_only_fields = fields


class ExternalAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalAuthor
        fields = ("provider", "handle", "display_name", "avatar_url", "profile_url")
        read_only_fields = fields


class EmbedSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmbedMetadata
        fields = ("embed_url", "width", "height")
        read_only_fields = fields


class ExternalContentSerializer(serializers.ModelSerializer):
    provider = serializers.CharField(source="provider_id", read_only=True)
    author = ExternalAuthorSerializer(read_only=True)
    embed = EmbedSerializer(read_only=True)

    class Meta:
        model = ExternalContent
        fields = ("id", "provider", "kind", "canonical_url", "title", "description", "thumbnail_url", "published_at", "author", "embed", "status")
        read_only_fields = fields
