from django.db import IntegrityError, connection, transaction

from apps.accounts.models import User
from apps.accounts.serializers import RegisterSerializer
from apps.accounts.services import anonymize_user, register_user
from apps.core.exceptions import ConflictError
from apps.core.models import OutboxEvent
from apps.core.testing import BaobabTestCase, make_user


class RegistrationTests(BaobabTestCase):
    def test_register_creates_full_identity_and_event_atomically(self):
        u = register_user(email="Ada@Example.com", username="Ada_Dev", password="S3cure-pass-phrase!")
        self.assertEqual((u.email, u.username), ("ada@example.com", "ada_dev"))
        self.assertTrue(hasattr(u, "security") and hasattr(u, "profile") and hasattr(u, "privacy") and hasattr(u, "preferences"))
        self.assertTrue(u.check_password("S3cure-pass-phrase!"))
        self.assertNotIn("S3cure", u.password)
        self.assertTrue(OutboxEvent.objects.filter(event_type="UserRegistered", aggregate_id=str(u.pk)).exists())

    def test_duplicates_are_case_insensitive(self):
        make_user("bob")
        with self.assertRaises(ConflictError):
            register_user(email="BOB@example.com", username="bob2", password="S3cure-pass-phrase!")
        with self.assertRaises(ConflictError):
            register_user(email="other@example.com", username="BOB", password="S3cure-pass-phrase!")

    def test_database_rejects_uppercase_email_and_bad_username_bypassing_the_orm_validation(self):
        make_user("seed")
        with connection.cursor() as cur, self.assertRaises(IntegrityError), transaction.atomic():
            cur.execute("UPDATE accounts_user SET email = 'UPPER@example.com' WHERE username = 'seed'")
        with connection.cursor() as cur, self.assertRaises(IntegrityError), transaction.atomic():
            cur.execute("UPDATE accounts_user SET username = 'Bad Name!' WHERE username = 'seed'")

    def test_suspended_user_must_have_a_reason_or_end_date(self):
        u = make_user()
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=u.pk).update(status="suspended")

    def test_serializer_rejects_weak_password_and_bad_username(self):
        s = RegisterSerializer(data={"email": "x@example.com", "username": "ab", "password": "12345678"})
        self.assertFalse(s.is_valid())
        self.assertIn("username", s.errors)
        s = RegisterSerializer(data={"email": "x@example.com", "username": "valid_name", "password": "password"})
        self.assertFalse(s.is_valid())
        self.assertIn("non_field_errors", s.errors)

    def test_anonymize_erases_personal_data_but_keeps_row(self):
        u = make_user("gone")
        u.profile.bio = "secret"
        u.profile.save()
        pk = u.pk
        anonymize_user(user=u)
        u = User.objects.get(pk=pk)
        self.assertEqual(u.status, "anonymized")
        self.assertTrue(u.email.endswith("@deleted.invalid") and u.username.startswith("deleted_"))
        self.assertFalse(u.has_usable_password())
        u.profile.refresh_from_db()
        self.assertEqual((u.profile.bio, u.profile.display_name), ("", "Utilisateur supprime"))
        self.assertEqual(u.privacy.profile_visibility, "private")

    def test_is_active_derives_from_status(self):
        u = make_user()
        self.assertTrue(u.is_active)
        for st in ("suspended", "deactivated", "deleted", "anonymized"):
            u.status = st
            self.assertFalse(u.is_active, st)
