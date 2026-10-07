from django.contrib import admin

from apps.core.models import IdempotencyRecord, OutboxEvent


@admin.register(OutboxEvent)
class OutboxEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "aggregate_type", "aggregate_id", "status", "attempts", "created_at")
    list_filter = ("status", "event_type")
    search_fields = ("aggregate_id", "event_type", "event_id")
    readonly_fields = [f.name for f in OutboxEvent._meta.fields]
    ordering = ("-id",)

    def has_add_permission(self, request):
        return False


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(admin.ModelAdmin):
    list_display = ("scope", "key", "status", "response_status", "created_at", "expires_at")
    list_filter = ("scope", "status")
    search_fields = ("key",)
    readonly_fields = [f.name for f in IdempotencyRecord._meta.fields]
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False
