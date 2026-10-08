"""Invariants et statistiques du recrutement (entreprise toujours proprietaire, creneaux sans chevauchement, historique inalterable)."""
from django.db import migrations

from apps.core.sql import run_files


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0007_reference_data_v4"), ("companies", "0001_initial"), ("portfolio", "0001_initial"), ("jobs", "0001_initial")]
    operations = [run_files(forward=["functions/008_opportunities.sql", "triggers/013_opportunities.sql", "views/023_opportunities_views.sql"], backward=["_down_opportunities.sql"])]
