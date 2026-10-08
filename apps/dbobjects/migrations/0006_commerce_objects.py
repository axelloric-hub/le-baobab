"""Fonctions, triggers et vues du commerce (avis, grand livre equilibre, audit financier)."""
from django.db import migrations

from apps.core.sql import run_files


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0005_reference_data_v3"), ("marketplace", "0001_initial"), ("payments", "0001_initial")]
    operations = [run_files(forward=["functions/007_commerce.sql", "triggers/012_commerce.sql", "views/022_commerce_views.sql"], backward=["_down_commerce.sql"])]
