from django.contrib import admin

from apps.community.models import (
    Channel, ChannelMember, Community, Group, GroupBan, GroupInvitation, GroupJoinRequest, GroupMember, GroupMute,
    GroupPermission, GroupRole,
)


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "privacy", "owner", "archived_at", "created_at")
    list_filter = ("privacy",)
    search_fields = ("name", "slug")
    raw_id_fields = ("owner", "country")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("-created_at",)


class GroupRoleInline(admin.TabularInline):
    model = GroupRole
    extra = 0


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "community", "privacy", "join_policy", "member_count", "archived_at")
    list_filter = ("privacy", "join_policy")
    search_fields = ("name", "slug")
    raw_id_fields = ("owner", "community")
    readonly_fields = ("member_count", "created_at", "updated_at")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [GroupRoleInline]
    ordering = ("-created_at",)


@admin.register(GroupPermission)
class GroupPermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "description")
    search_fields = ("code",)


@admin.register(GroupRole)
class GroupRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "position", "is_default", "is_owner_role")
    search_fields = ("name", "group__name")
    raw_id_fields = ("group",)
    filter_horizontal = ("permissions",)


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "group", "role", "joined_at")
    search_fields = ("user__username", "group__name")
    raw_id_fields = ("user", "group", "invited_by")
    list_select_related = ("user", "group", "role")


@admin.register(GroupInvitation)
class GroupInvitationAdmin(admin.ModelAdmin):
    list_display = ("group", "invited_user", "status", "expires_at")
    list_filter = ("status",)
    raw_id_fields = ("group", "invited_user", "invited_by")


@admin.register(GroupJoinRequest)
class GroupJoinRequestAdmin(admin.ModelAdmin):
    list_display = ("group", "user", "status", "created_at")
    list_filter = ("status",)
    raw_id_fields = ("group", "user", "reviewed_by")


@admin.register(GroupBan)
class GroupBanAdmin(admin.ModelAdmin):
    list_display = ("group", "user", "banned_by", "expires_at", "created_at")
    raw_id_fields = ("group", "user", "banned_by")


@admin.register(GroupMute)
class GroupMuteAdmin(admin.ModelAdmin):
    list_display = ("group", "user", "expires_at")
    raw_id_fields = ("group", "user", "muted_by")


@admin.register(Channel)
class ChannelAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "group", "community", "archived_at")
    list_filter = ("type",)
    search_fields = ("name", "slug")
    raw_id_fields = ("group", "community", "created_by")


@admin.register(ChannelMember)
class ChannelMemberAdmin(admin.ModelAdmin):
    list_display = ("channel", "user", "role", "joined_at")
    raw_id_fields = ("channel", "user")
