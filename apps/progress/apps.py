from django.apps import AppConfig


class ProgressConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.progress"
    label = "progress"
    verbose_name = "Progression & certificats"

    def ready(self) -> None:
        from apps.progress import handlers  # noqa: F401
