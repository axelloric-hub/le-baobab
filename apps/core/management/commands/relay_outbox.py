import time

from django.core.management.base import BaseCommand

from apps.core.outbox import relay_batch


class Command(BaseCommand):
    help = "Relaie les evenements de l'outbox vers les consommateurs (Mongo, Redis, notifications, analytics). Process unique ou N workers (SKIP LOCKED)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="un seul lot puis quitte (cron)")
        parser.add_argument("--interval", type=float, default=1.0)
        parser.add_argument("--batch", type=int, default=100)

    def handle(self, *args, **o):
        while True:
            stats = relay_batch(o["batch"])
            if any(stats.values()):
                self.stdout.write(str(stats))
            if o["once"]:
                return
            if not stats["processed"]:
                time.sleep(o["interval"])
