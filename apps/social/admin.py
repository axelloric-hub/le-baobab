from django.contrib import admin

from apps.social.models import (
    Comment, Hashtag, Poll, PollOption, Post, PostMedia, Save, Share, Status,
)


class PostMediaInline(admin.TabularInline):
    model = PostMedia
    extra = 0


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "kind", "visibility", "status", "reaction_count", "comment_count", "published_at", "deleted_at")
    list_filter = ("kind", "visibility", "status")
    search_fields = ("title", "body", "author__username")
    raw_id_fields = ("author", "group", "community", "deleted_by")
    readonly_fields = ("reaction_count", "comment_count", "share_count", "save_count", "view_count", "created_at", "updated_at")
    inlines = [PostMediaInline]
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    fieldsets = (
        (None, {"fields": ("author", "kind", "status", "title", "body", "language", "payload")}),
        ("Portee", {"fields": ("visibility", "group", "community", "comments_enabled", "is_pinned")}),
        ("Compteurs (derives)", {"fields": ("reaction_count", "comment_count", "share_count", "save_count", "view_count")}),
        ("Suppression", {"fields": ("deleted_at", "deleted_by", "deletion_reason")}),
        ("Dates", {"fields": ("published_at", "edited_at", "created_at", "updated_at")}),
    )


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "author", "depth", "created_at", "deleted_at")
    search_fields = ("body", "author__username")
    raw_id_fields = ("post", "author", "parent", "deleted_by")
    readonly_fields = ("reaction_count", "reply_count", "created_at")
    ordering = ("-created_at",)


@admin.register(Hashtag)
class HashtagAdmin(admin.ModelAdmin):
    list_display = ("tag", "post_count")
    search_fields = ("tag",)
    ordering = ("-post_count",)


class PollOptionInline(admin.TabularInline):
    model = PollOption
    extra = 0
    readonly_fields = ("vote_count",)


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ("question", "allows_multiple", "closes_at")
    raw_id_fields = ("post",)
    inlines = [PollOptionInline]


@admin.register(Share)
class ShareAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "visibility", "created_at")
    raw_id_fields = ("user", "post")


@admin.register(Save)
class SaveAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "collection", "created_at")
    raw_id_fields = ("user", "post")


@admin.register(Status)
class StatusAdmin(admin.ModelAdmin):
    list_display = ("author", "kind", "visibility", "expires_at", "view_count", "archived_at")
    list_filter = ("kind", "visibility")
    search_fields = ("author__username", "body")
    raw_id_fields = ("author", "deleted_by")
    readonly_fields = ("view_count", "created_at")
    ordering = ("-created_at",)
