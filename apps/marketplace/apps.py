from django.apps import AppConfig


class MarketplaceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.marketplace"
    label = "marketplace"
    verbose_name = "Marketplace (catalogue, panier, commandes, licences)"

    def ready(self) -> None:
        from apps.marketplace.moderation_hooks import register_hooks

        register_hooks()
