from django.apps import AppConfig


class EducationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.education"
    label = "education"
    verbose_name = "Education (classrooms, cours, contenus, acces)"

    def ready(self) -> None:
        from apps.core.registries import register_entitlement_target_validator
        from apps.education import handlers  # noqa: F401
        from apps.education.services import sellable_target

        register_entitlement_target_validator(sellable_target)
