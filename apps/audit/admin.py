from django.contrib import admin

from apps.audit.models import AdminAction, AuditLog, SecurityEvent, SystemEvent


class ReadOnlyAdmin(admin.ModelAdmin):
    """L'audit ne se modifie jamais depuis l'admin (la base l'interdit de toute facon)."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AuditLog)
class AuditLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "action", "object_type", "object_id", "actor_label", "source")
    list_filter = ("source", "object_type", "action")
    search_fields = ("object_id", "actor_label", "correlation_id")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"


@admin.register(AdminAction)
class AdminActionAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "admin", "action", "target_type", "target_id")
    list_filter = ("action",)
    search_fields = ("target_id", "reason")
    ordering = ("-created_at",)


@admin.register(SecurityEvent)
class SecurityEventAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "event_type", "severity", "user", "ip_address")
    list_filter = ("severity", "event_type")
    search_fields = ("user__username", "ip_address")
    ordering = ("-created_at",)


@admin.register(SystemEvent)
class SystemEventAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "level", "component", "message")
    list_filter = ("level", "component")
    search_fields = ("message",)
    ordering = ("-created_at",)
