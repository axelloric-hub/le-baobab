from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.messaging"
    label = "messaging"
    verbose_name = "Conversations & messagerie"

    def ready(self) -> None:
        from apps.messaging.moderation_hooks import register_hooks

        register_hooks()
