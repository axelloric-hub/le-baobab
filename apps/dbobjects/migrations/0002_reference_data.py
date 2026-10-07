"""Donnees de reference (pays africains, types de notifications/evenements, motifs de signalement, fournisseurs, referentiel de competences)."""
from django.db import migrations

from apps.dbobjects.migrations import _load_0002


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0001_postgres_objects")]
    operations = [migrations.RunPython(_load_0002.load, migrations.RunPython.noop)]
