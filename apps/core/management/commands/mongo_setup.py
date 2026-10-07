from django.core.management.base import BaseCommand

from apps.core.mongo import ensure_schema


class Command(BaseCommand):
    help = "Cree/Met a jour collections, validateurs JSON Schema et index MongoDB (idempotent)."

    def handle(self, *args, **opts):
        self.stdout.write(self.style.SUCCESS(f"MongoDB: {ensure_schema()}"))
