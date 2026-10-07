from django.contrib import admin

from apps.friends.models import Block, CloseFriend, Follow, Friendship, Mute, Restriction


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("user_low", "user_high", "status", "requested_by", "created_at")
    list_filter = ("status",)
    search_fields = ("user_low__username", "user_high__username")
    raw_id_fields = ("user_low", "user_high", "requested_by")
    readonly_fields = ("created_at", "updated_at", "responded_at")
    ordering = ("-created_at",)


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ("follower", "followee", "created_at")
    search_fields = ("follower__username", "followee__username")
    raw_id_fields = ("follower", "followee")
    ordering = ("-created_at",)


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
    search_fields = ("blocker__username", "blocked__username")
    raw_id_fields = ("blocker", "blocked")
    ordering = ("-created_at",)


@admin.register(Mute)
class MuteAdmin(admin.ModelAdmin):
    list_display = ("muter", "muted", "scope", "expires_at")
    list_filter = ("scope",)
    raw_id_fields = ("muter", "muted")


@admin.register(CloseFriend)
class CloseFriendAdmin(admin.ModelAdmin):
    list_display = ("owner", "friend", "created_at")
    raw_id_fields = ("owner", "friend")


@admin.register(Restriction)
class RestrictionAdmin(admin.ModelAdmin):
    list_display = ("restrictor", "restricted", "created_at")
    raw_id_fields = ("restrictor", "restricted")
