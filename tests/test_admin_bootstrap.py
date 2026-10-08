import os
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import User
from apps.core.api_testing import api_client, verified_user
from apps.core.checks import active_test_flags, test_flags_check
from apps.core.testing import BaobabTestCase

PW = "Admin-solide-2026-Baobab!"


class EnsureAdminTests(BaobabTestCase):
    def run_cmd(self, **env):
        with mock.patch.dict(os.environ, env, clear=False):
            out = StringIO()
            call_command("ensure_admin", stdout=out)
            return out.getvalue()

    def test_creates_a_working_staff_account_once_and_never_overwrites_the_password(self):
        self.run_cmd(ADMIN_EMAIL="Root@Example.com", ADMIN_PASSWORD=PW, ADMIN_USERNAME="root_admin")
        u = User.objects.get(email="root@example.com")
        self.assertEqual((u.is_staff, u.is_superuser, u.status, u.email_verified_at is not None), (True, True, "active", True))
        self.assertEqual(api_client().post("/api/v1/auth/login/", {"email": "root@example.com", "password": PW}, format="json").status_code, 200)
        self.assertEqual(api_client(u).get("/api/v1/admin/system/status/").status_code, 200)
        self.assertIn("deja present", self.run_cmd(ADMIN_EMAIL="root@example.com", ADMIN_PASSWORD="Autre-mot-de-passe-9!"))
        self.assertEqual(User.objects.filter(email="root@example.com").count(), 1)
        self.assertTrue(User.objects.get(email="root@example.com").check_password(PW))  # relancer avec un autre mot de passe ne l'ecrase pas

    def test_repairs_an_existing_account_and_refuses_weak_or_missing_passwords(self):
        u = verified_user("promu")
        self.run_cmd(ADMIN_EMAIL=u.email)
        self.assertTrue(User.objects.get(pk=u.pk).is_superuser)
        with self.assertRaises(CommandError):
            self.run_cmd(ADMIN_EMAIL="nouveau@example.com", ADMIN_PASSWORD="123")
        with self.assertRaises(CommandError):
            self.run_cmd(ADMIN_EMAIL="nouveau@example.com", ADMIN_PASSWORD="")
        self.assertFalse(User.objects.filter(email="nouveau@example.com").exists())

    def test_does_nothing_without_admin_email(self):
        self.assertIn("rien a faire", self.run_cmd(ADMIN_EMAIL=""))


class TestFlagsTests(BaobabTestCase):
    @override_settings(OTP_DEBUG_ECHO=False, PAYMENTS_SIMULATION_ENABLED=False, STORAGE_FAKE_AUTO_COMPLETE=False, STORAGE_BACKEND="s3")
    def test_production_configuration_has_no_warning(self):
        self.assertEqual((active_test_flags(), test_flags_check(None)), ({}, []))

    @override_settings(OTP_DEBUG_ECHO=True, PAYMENTS_SIMULATION_ENABLED=True, STORAGE_FAKE_AUTO_COMPLETE=True, STORAGE_BACKEND="fake")
    def test_every_test_switch_is_reported_and_only_admins_can_read_the_status(self):
        self.assertEqual(len(test_flags_check(None)), 4)
        adm = verified_user("sysadmin"); adm.is_staff = True; adm.save()
        r = api_client(adm).get("/api/v1/admin/system/status/").json()
        self.assertEqual((r["production_ready"], {f["flag"] for f in r["test_flags_active"]}), (False, {"OTP_DEBUG_ECHO", "PAYMENTS_SIMULATION_ENABLED", "STORAGE_FAKE_AUTO_COMPLETE", "STORAGE_BACKEND=fake"}))
        self.assertEqual(api_client(verified_user("simple")).get("/api/v1/admin/system/status/").status_code, 403)
        self.assertEqual(api_client().get("/api/v1/admin/system/status/").status_code, 401)
        self.assertNotIn("OTP_DEBUG_ECHO", api_client().get("/ready/").content.decode())  # /ready/ public : n'annonce jamais la faille
