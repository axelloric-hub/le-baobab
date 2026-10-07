from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import Device, LoginAttempt, LoginHistory, SecuritySettings, User


class SecurityInline(admin.StackedInline):
    model = SecuritySettings
    extra = 0
    can_delete = False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("username", "email", "status", "is_staff", "email_verified_at", "date_joined")
    list_filter = ("status", "is_staff", "is_superuser")
    search_fields = ("email", "username")
    readonly_fields = ("id", "date_joined", "last_login", "password_changed_at", "anonymized_at")
    inlines = [SecurityInline]
    fieldsets = (
        (None, {"fields": ("id", "email", "username", "password")}),
        ("Statut", {"fields": ("status", "email_verified_at", "suspended_until", "suspension_reason", "deleted_at", "anonymized_at")}),
        ("Permissions", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("date_joined", "last_login", "password_changed_at")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),)


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "label", "is_trusted", "last_seen_at", "revoked_at")
    list_filter = ("platform", "is_trusted")
    search_fields = ("user__email", "user__username", "label")
    autocomplete_fields = ("user",)
    ordering = ("-last_seen_at",)


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ("user", "success", "method", "ip_address", "country_code", "created_at")
    list_filter = ("success", "method")
    search_fields = ("user__email", "ip_address")
    readonly_fields = [f.name for f in LoginHistory._meta.fields]
    ordering = ("-created_at",)


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("identifier", "ip_address", "success", "reason", "created_at")
    list_filter = ("success",)
    search_fields = ("identifier", "ip_address")
    readonly_fields = [f.name for f in LoginAttempt._meta.fields]
    ordering = ("-created_at",)
