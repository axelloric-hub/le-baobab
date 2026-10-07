from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.analytics"
    label = "analytics"
    verbose_name = "Analytics (OLAP leger)"

    def ready(self) -> None:
        from apps.analytics import handlers  # noqa: F401
