"""Types de notification du recrutement. Rejoue le chargement idempotent."""
from django.db import migrations

from apps.dbobjects.migrations import _load_0002


class Migration(migrations.Migration):
    dependencies = [("dbobjects", "0008_opportunities_objects")]
    operations = [migrations.RunPython(_load_0002.load, migrations.RunPython.noop)]
