from django.apps import AppConfig


class DbObjectsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dbobjects"
    label = "dbobjects"
    verbose_name = "Objets PostgreSQL (fonctions, triggers, vues)"
