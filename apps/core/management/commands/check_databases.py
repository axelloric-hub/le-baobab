import sys

from django.core.management.base import BaseCommand

from apps.core.verify import verify_all


class Command(BaseCommand):
    help = "Verifie PostgreSQL (tables, index, fonctions, triggers), MongoDB (collections, index) et Redis (scripts, config)."

    def handle(self, *args, **o):
        results = verify_all()
        failed = 0
        for name, ok, detail in results:
            failed += not ok
            self.stdout.write(f"[{'OK' if ok else 'KO'}] {name}: {detail}")
        if failed:
            self.stderr.write(self.style.ERROR(f"{failed} verification(s) en echec"))
            sys.exit(1)
        self.stdout.write(self.style.SUCCESS("Toutes les verifications sont OK"))
