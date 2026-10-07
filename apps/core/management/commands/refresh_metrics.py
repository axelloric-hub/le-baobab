from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = "Recalcule les agregats quotidiens (analytics_daily_metric) : baobab_refresh_daily_metrics(jour). Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=2, help="nombre de jours recalcules (aujourd'hui inclus)")

    def handle(self, *args, **o):
        today = timezone.now().date()
        with connection.cursor() as cur:
            for i in range(o["days"]):
                cur.execute("SELECT baobab_refresh_daily_metrics(%s)", [today - timedelta(days=i)])
        self.stdout.write(self.style.SUCCESS(f"{o['days']} jour(s) recalcule(s)"))
