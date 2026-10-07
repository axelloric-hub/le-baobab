from rest_framework import serializers

from apps.core.choices import Visibility
from apps.social.models import Comment, Post, PostMedia, ReactionType, Status


class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ("id", "kind", "storage_key", "mime_type", "size_bytes", "width", "height", "duration_seconds", "alt_text", "position")
        read_only_fields = ("id", "position")


class PollInputSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=300)
    options = serializers.ListField(child=serializers.CharField(max_length=200), min_length=2, max_length=10)
    allows_multiple = serializers.BooleanField(default=False)
    is_anonymous = serializers.BooleanField(default=False)
    closes_at = serializers.DateTimeField(required=False, allow_null=True)


class PostCreateSerializer(serializers.Serializer):
    """Ecriture : liste blanche. Auteur/compteurs/statut ne sont JAMAIS acceptes du client."""

    kind = serializers.ChoiceField(choices=Post.Kind.choices, default=Post.Kind.TEXT)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    body = serializers.CharField(max_length=20000, required=False, allow_blank=True, default="")
    visibility = serializers.ChoiceField(choices=Visibility.choices, required=False)
    group = serializers.UUIDField(required=False, allow_null=True)
    payload = serializers.DictField(required=False, default=dict)
    media = PostMediaSerializer(many=True, required=False, max_length=10)
    audience = serializers.ListField(child=serializers.UUIDField(), required=False, max_length=500)
    poll = PollInputSerializer(required=False)

    def validate(self, attrs):
        if attrs["kind"] == Post.Kind.TEXT and not attrs.get("body", "").strip():
            raise serializers.ValidationError({"body": "Un post texte ne peut pas etre vide."})
        if attrs.get("visibility") == Visibility.CUSTOM and not attrs.get("audience"):
            raise serializers.ValidationError({"audience": "Audience requise pour une visibilite personnalisee."})
        return attrs


class PostSerializer(serializers.ModelSerializer):
    """Lecture."""

    author_username = serializers.CharField(source="author.username", read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = ("id", "author", "author_username", "kind", "title", "body", "visibility", "group", "payload", "media",
                  "reaction_count", "comment_count", "share_count", "save_count", "view_count", "published_at", "edited_at")
        read_only_fields = fields


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=5000)
    parent = serializers.UUIDField(required=False, allow_null=True)


class CommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    body = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "post", "author", "author_username", "parent", "depth", "body", "reaction_count", "reply_count", "created_at", "edited_at")
        read_only_fields = fields

    def get_body(self, obj: Comment) -> str:
        return "" if obj.deleted_at else obj.body


class ReactionInputSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ReactionType.choices, allow_null=True)


class StatusCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Status.Kind.choices, default=Status.Kind.TEXT)
    body = serializers.CharField(max_length=700, required=False, allow_blank=True, default="")
    storage_key = serializers.CharField(max_length=400, required=False, allow_blank=True, default="")
    mime_type = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    link_url = serializers.URLField(required=False, allow_blank=True, default="")
    visibility = serializers.ChoiceField(choices=[c for c in Visibility.choices if c[0] != "group_members"], required=False)
    audience = serializers.ListField(child=serializers.UUIDField(), required=False, max_length=500)


class StatusSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Status
        fields = ("id", "author", "author_username", "kind", "body", "storage_key", "mime_type", "link_url", "style",
                  "visibility", "expires_at", "view_count", "created_at")
        read_only_fields = fields
