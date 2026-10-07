from django.contrib import admin

from apps.integrations.models import EmbedMetadata, ExternalAccount, ExternalAuthor, ExternalContent, ExternalProvider, SyncState


@admin.register(ExternalProvider)
class ExternalProviderAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "supports_oauth", "supports_embed", "max_cache_hours", "is_active")
    list_filter = ("is_active",)


@admin.register(ExternalAccount)
class ExternalAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "handle", "connected_at", "revoked_at")
    list_filter = ("provider",)
    search_fields = ("user__username", "handle")
    raw_id_fields = ("user",)
    exclude = ("access_token", "refresh_token")  # jamais affiches


@admin.register(ExternalAuthor)
class ExternalAuthorAdmin(admin.ModelAdmin):
    list_display = ("handle", "provider", "display_name", "fetched_at")
    list_filter = ("provider",)
    search_fields = ("handle", "display_name")


class EmbedInline(admin.StackedInline):
    model = EmbedMetadata
    extra = 0


@admin.register(ExternalContent)
class ExternalContentAdmin(admin.ModelAdmin):
    list_display = ("title", "provider", "kind", "status", "fetched_at", "expires_at")
    list_filter = ("provider", "kind", "status")
    search_fields = ("title", "external_id", "canonical_url")
    raw_id_fields = ("author",)
    inlines = [EmbedInline]
    ordering = ("-fetched_at",)


@admin.register(SyncState)
class SyncStateAdmin(admin.ModelAdmin):
    list_display = ("provider", "resource", "status", "last_synced_at", "next_sync_at")
    list_filter = ("provider", "status")
