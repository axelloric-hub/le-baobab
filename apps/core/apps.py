from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    label = "core"
    verbose_name = "Core (briques transverses)"

    def ready(self) -> None:
        from django.conf import settings

        from apps.core import checks  # noqa: F401  (enregistre le controle des interrupteurs de test)

        checks.warn_at_startup()
        if settings.ENABLE_IN_PROCESS_SCHEDULER:  # active uniquement sur le service web (variable d'environnement)
            from apps.core.scheduler import start_in_background

            start_in_background()
