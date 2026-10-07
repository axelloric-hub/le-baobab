from django.core.management.base import BaseCommand
from django.db import connection

VIEWS = ("mv_platform_daily", "mv_trending_hashtags")


class Command(BaseCommand):
    help = "REFRESH MATERIALIZED VIEW CONCURRENTLY (lecture non bloquee). trending: toutes les 10 min ; platform_daily: horaire."

    def add_arguments(self, parser):
        parser.add_argument("views", nargs="*", default=list(VIEWS))

    def handle(self, *args, **o):
        with connection.cursor() as cur:
            for v in o["views"]:
                if v not in VIEWS:
                    raise SystemExit(f"vue inconnue: {v}")
                cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {v}")
                self.stdout.write(f"{v} OK")
