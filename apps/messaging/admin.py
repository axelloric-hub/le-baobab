from django.contrib import admin

from apps.messaging.models import Conversation, ConversationMember, Mention, Message, MessageAttachment, MessageReaction


class MemberInline(admin.TabularInline):
    model = ConversationMember
    extra = 0
    raw_id_fields = ("user",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "title", "message_seq", "last_message_at", "created_at")
    list_filter = ("type",)
    search_fields = ("title", "id")
    raw_id_fields = ("group", "channel", "created_by")
    readonly_fields = ("message_seq", "last_message_id", "last_message_at", "direct_key", "created_at")
    inlines = [MemberInline]
    ordering = ("-last_message_at",)


class AttachmentInline(admin.TabularInline):
    model = MessageAttachment
    extra = 0


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Lecture seule : la moderation passe par moderation.ModerationAction (tracable)."""

    list_display = ("id", "conversation", "sender", "seq", "kind", "created_at", "deleted_at")
    list_filter = ("kind",)
    search_fields = ("body", "sender__username")
    raw_id_fields = ("conversation", "sender", "reply_to", "thread_root", "deleted_by")
    readonly_fields = ("seq", "reply_count", "last_reply_at", "created_at")
    inlines = [AttachmentInline]
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False


@admin.register(MessageReaction)
class MessageReactionAdmin(admin.ModelAdmin):
    list_display = ("message", "user", "emoji", "created_at")
    raw_id_fields = ("message", "user")


@admin.register(Mention)
class MentionAdmin(admin.ModelAdmin):
    list_display = ("message", "mentioned_user", "created_at")
    raw_id_fields = ("message", "mentioned_user")
