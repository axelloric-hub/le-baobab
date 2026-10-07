"""Fonctions, triggers et vues du domaine education (acces payant, progression, audit)."""
from django.db import migrations

from apps.core.sql import run_files


class Migration(migrations.Migration):
    dependencies = [
        ("dbobjects", "0003_reference_data_v2"),
        ("education", "0001_initial"),
        ("assessments", "0001_initial"),
        ("progress", "0001_initial"),
    ]
    operations = [run_files(forward=["functions/006_education.sql", "triggers/011_education.sql", "views/021_education_views.sql"],
                            backward=["_down_education.sql"])]
