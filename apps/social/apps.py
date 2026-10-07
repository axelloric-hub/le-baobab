from django.apps import AppConfig


class SocialConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.social"
    label = "social"
    verbose_name = "Publications, commentaires & statuts"

    def ready(self) -> None:
        from apps.social import handlers  # noqa: F401  (abonnements outbox)
        from apps.social.moderation_hooks import register_hooks

        register_hooks()
