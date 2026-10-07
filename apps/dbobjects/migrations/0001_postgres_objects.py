"""Fonctions, triggers, vues, index et contraintes PostgreSQL (database/postgres/*). Depend de TOUS les schemas applicatifs."""
from django.db import migrations

from apps.core.sql import run_files


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
        ("accounts", "0001_initial"),
        ("profiles", "0001_initial"),
        ("friends", "0001_initial"),
        ("community", "0001_initial"),
        ("messaging", "0001_initial"),
        ("social", "0001_initial"),
        ("notifications", "0001_initial"),
        ("audit", "0001_initial"),
        ("moderation", "0001_initial"),
        ("integrations", "0001_initial"),
        ("analytics", "0001_initial"),
    ]
    operations = [
        run_files(
            forward=[
                "functions/001_common.sql", "functions/002_counters.sql", "functions/003_messaging.sql",
                "functions/004_audit.sql", "functions/005_domain_queries.sql",
                "triggers/010_attach.sql", "views/020_views.sql", "indexes/030_indexes.sql",
            ],
            backward=["_down.sql"],
        )
    ]
