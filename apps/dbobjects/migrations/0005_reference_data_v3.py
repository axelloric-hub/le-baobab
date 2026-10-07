"""Types de notification du domaine education. Rejoue le chargement idempotent."""
from django.db import migrations

from apps.dbobjects.migrations import _load_0002


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0004_education_objects")]
    operations = [migrations.RunPython(_load_0002.load, migrations.RunPython.noop)]
