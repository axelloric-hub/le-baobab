from django.contrib import admin

from apps.analytics.models import DailyMetric, EventType


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "domain", "actor_required", "contains_pii", "retention_days", "is_active")
    list_filter = ("domain", "is_active", "contains_pii")
    search_fields = ("code",)


@admin.register(DailyMetric)
class DailyMetricAdmin(admin.ModelAdmin):
    list_display = ("day", "metric", "dimension", "value", "computed_at")
    list_filter = ("metric",)
    date_hierarchy = "day"
    ordering = ("-day",)
