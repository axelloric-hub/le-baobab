from django.core.management import call_command
from django.test import TestCase

from apps.core.mongo import ensure_schema
from apps.core.testing import reset_stores
from apps.core.verify import verify_all


class DatabaseVerificationTests(TestCase):
    """Equivalent automatise de scripts/check_databases.py sur PostgreSQL + Redis reels (MongoDB: mongomock)."""

    def test_every_check_passes_after_setup(self):
        reset_stores(); ensure_schema()
        failures = [(n, d) for n, ok, d in verify_all() if not ok]
        self.assertEqual(failures, [])

    def test_mongo_check_reports_missing_collections_before_setup(self):
        reset_stores()
        self.assertTrue(any(n.startswith("mongodb.") and not ok for n, ok, _ in verify_all()))

    def test_management_commands_run(self):
        reset_stores()
        call_command("mongo_setup", verbosity=0); call_command("relay_outbox", once=True, verbosity=0)
        call_command("check_databases", verbosity=0)
