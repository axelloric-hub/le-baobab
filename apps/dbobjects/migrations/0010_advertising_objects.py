"""Coherence du portefeuille publicitaire (solde == journal, verifie au commit), journaux inalterables, statistiques."""
from django.db import migrations

from apps.core.sql import run_files


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0009_reference_data_v5"), ("advertising", "0001_initial")]
    operations = [run_files(forward=["functions/009_advertising.sql", "triggers/014_advertising.sql", "views/024_advertising_views.sql"], backward=["_down_advertising.sql"])]
