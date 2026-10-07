from rest_framework import serializers

from apps.messaging.models import Conversation, ConversationMember, Message, MessageAttachment


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = ("id", "storage_key", "filename", "mime_type", "size_bytes", "width", "height", "duration_seconds")
        read_only_fields = ("id",)


class MessageSerializer(serializers.ModelSerializer):
    """Lecture. Un message supprime pour tous n'expose jamais son contenu."""

    sender_username = serializers.CharField(source="sender.username", read_only=True, default=None)
    attachments = AttachmentSerializer(many=True, read_only=True)
    body = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ("id", "conversation", "seq", "sender", "sender_username", "kind", "body", "reply_to", "thread_root",
                  "reply_count", "edited_at", "created_at", "attachments")
        read_only_fields = fields

    def get_body(self, obj: Message) -> str:
        return "" if obj.deleted_at else obj.body


class MessageCreateSerializer(serializers.Serializer):
    """Ecriture : validation d'entree uniquement ; la logique est dans services.send_message."""

    body = serializers.CharField(max_length=10000, allow_blank=True, required=False, default="")
    kind = serializers.ChoiceField(choices=Message.Kind.choices, default=Message.Kind.TEXT)
    reply_to = serializers.UUIDField(required=False, allow_null=True)
    thread_root = serializers.UUIDField(required=False, allow_null=True)
    client_msg_id = serializers.UUIDField(required=False, allow_null=True)
    attachments = AttachmentSerializer(many=True, required=False)

    def validate(self, attrs):
        if attrs.get("kind", "text") == "text" and not attrs.get("body", "").strip():
            raise serializers.ValidationError({"body": "Le message ne peut pas etre vide."})
        return attrs


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ("id", "type", "title", "last_message_at", "created_at")
        read_only_fields = fields


class InboxItemSerializer(serializers.ModelSerializer):
    conversation = ConversationSerializer(read_only=True)
    unread = serializers.IntegerField(read_only=True)

    class Meta:
        model = ConversationMember
        fields = ("conversation", "unread", "muted_until", "last_read_seq")
        read_only_fields = fields
