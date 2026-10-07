from django.contrib import admin

from apps.notifications.models import Notification, NotificationDelivery, NotificationPreference, NotificationTemplate, NotificationType


class TemplateInline(admin.TabularInline):
    model = NotificationTemplate
    extra = 0


@admin.register(NotificationType)
class NotificationTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "category", "is_critical", "is_active")
    list_filter = ("category", "is_critical", "is_active")
    search_fields = ("code",)
    inlines = [TemplateInline]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "type", "actor", "read_at", "created_at")
    list_filter = ("type",)
    search_fields = ("recipient__username",)
    raw_id_fields = ("recipient", "actor")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = ("notification", "channel", "status", "attempts", "sent_at")
    list_filter = ("channel", "status")
    raw_id_fields = ("notification",)


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "type", "channel", "enabled")
    list_filter = ("channel", "enabled")
    raw_id_fields = ("user",)
