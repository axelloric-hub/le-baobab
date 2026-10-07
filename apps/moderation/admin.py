from django.contrib import admin

from apps.moderation.models import ContentViolation, ModerationAction, ModerationCase, Report, ReportReason, UserRestriction


@admin.register(ReportReason)
class ReportReasonAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "severity", "is_active")
    list_filter = ("is_active", "severity")


class ReportInline(admin.TabularInline):
    model = Report
    extra = 0
    can_delete = False
    readonly_fields = ("reporter", "reason", "details", "status", "created_at")


@admin.register(ModerationCase)
class ModerationCaseAdmin(admin.ModelAdmin):
    list_display = ("id", "subject_type", "subject_user", "status", "priority", "assignee", "opened_at")
    list_filter = ("status", "subject_type", "priority")
    search_fields = ("subject_id", "subject_user__username")
    raw_id_fields = ("subject_user", "assignee")
    readonly_fields = ("opened_at", "resolved_at")
    inlines = [ReportInline]
    ordering = ("-priority", "opened_at")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("target_type", "target_id", "reason", "status", "reporter", "created_at")
    list_filter = ("status", "reason", "target_type")
    search_fields = ("target_id", "reporter__username")
    raw_id_fields = ("reporter", "target_user", "case")
    ordering = ("-created_at",)


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    """Journal de moderation : lecture seule (immuable en base)."""

    list_display = ("created_at", "action", "target_type", "target_id", "moderator", "target_user")
    list_filter = ("action", "target_type")
    search_fields = ("target_id", "moderator__username", "target_user__username")
    ordering = ("-created_at",)

    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False


@admin.register(ContentViolation)
class ContentViolationAdmin(admin.ModelAdmin):
    list_display = ("user", "policy_code", "points", "created_at", "expires_at")
    search_fields = ("user__username", "policy_code")
    raw_id_fields = ("user", "action")


@admin.register(UserRestriction)
class UserRestrictionAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "starts_at", "ends_at", "revoked_at")
    list_filter = ("kind",)
    search_fields = ("user__username",)
    raw_id_fields = ("user", "action", "revoked_by")
