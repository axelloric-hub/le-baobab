from django.core.management.base import BaseCommand
from django.db import connection

from apps.social.services import archive_expired_statuses


class Command(BaseCommand):
    help = "Maintenance : purge technique par lots (SQL) + archivage des statuts expires. A planifier toutes les heures."

    def handle(self, *args, **o):
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_housekeeping()")
            self.stdout.write(str(cur.fetchone()[0]))
        self.stdout.write(f"statuts archives: {archive_expired_statuses()}")
