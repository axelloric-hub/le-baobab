"""Correctif de reference : friendship_created n'a pas d'acteur unique (c'est une paire). Rejoue le chargement idempotent."""
from django.db import migrations

from apps.dbobjects.migrations import _load_0002


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0002_reference_data")]
    operations = [migrations.RunPython(_load_0002.load, migrations.RunPython.noop)]
