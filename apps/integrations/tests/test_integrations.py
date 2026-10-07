from datetime import timedelta

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import override_settings
from django.utils import timezone
from cryptography.fernet import Fernet

from apps.core.testing import BaobabTestCase, make_user
from apps.integrations.models import EmbedMetadata, ExternalAccount, ExternalContent, ExternalProvider
from apps.integrations.serializers import ExternalAccountSerializer

KEY = Fernet.generate_key().decode()


class IntegrationTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.u = make_user()
        self.tiktok, self.github = ExternalProvider.objects.get(pk="tiktok"), ExternalProvider.objects.get(pk="github")

    def content(self, provider=None, ext="v1"):
        return ExternalContent.objects.create(provider=provider or self.tiktok, external_id=ext, kind="video", canonical_url="https://www.tiktok.com/@a/video/1",
                                               expires_at=timezone.now() + timedelta(hours=24))

    def test_reference_providers_loaded(self):
        self.assertEqual(set(ExternalProvider.objects.values_list("code", flat=True)), {"github", "gitlab", "linkedin", "tiktok", "youtube"})

    def test_embed_only_from_official_allowlisted_https_hosts(self):
        c = self.content()
        EmbedMetadata.objects.create(content=c, embed_url="https://www.tiktok.com/embed/v2/123")
        for bad in ("https://evil.example/embed/1", "http://www.tiktok.com/embed/1", "https://www.tiktok.com.evil.io/x"):
            with self.assertRaises(ValidationError, msg=bad):
                EmbedMetadata(content=ExternalContent.objects.create(provider=self.tiktok, external_id=bad[-12:] + "z", kind="video", canonical_url="https://www.tiktok.com/x",
                                                                      expires_at=timezone.now() + timedelta(hours=1)), embed_url=bad).save()
        gh = self.content(self.github, "r1")
        with self.assertRaises(ValidationError):  # GitHub n'a pas d'embed
            EmbedMetadata(content=gh, embed_url="https://github.com/x/y").save()

    def test_tokens_are_encrypted_at_rest_and_never_serialized(self):
        with override_settings(FIELD_ENCRYPTION_KEY=KEY):
            acc = ExternalAccount.objects.create(user=self.u, provider=self.github, external_id="42", handle="octo", access_token="gho_supersecret", scopes=["read:user"])
            with connection.cursor() as cur:
                cur.execute("SELECT access_token FROM integrations_account WHERE id = %s", [acc.pk])
                raw = cur.fetchone()[0]
            self.assertNotIn("supersecret", raw)
            self.assertEqual(ExternalAccount.objects.get(pk=acc.pk).access_token, "gho_supersecret")
            self.assertNotIn("access_token", ExternalAccountSerializer(acc).data)
            self.assertNotIn("gho_", str(ExternalAccountSerializer(acc).data))

    def test_missing_encryption_key_fails_loudly(self):
        with override_settings(FIELD_ENCRYPTION_KEY=""), self.assertRaises(ImproperlyConfigured):
            ExternalAccount.objects.create(user=self.u, provider=self.github, external_id="1", access_token="x")

    def test_one_external_identity_belongs_to_one_user_and_one_active_account_per_provider(self):
        with override_settings(FIELD_ENCRYPTION_KEY=KEY):
            ExternalAccount.objects.create(user=self.u, provider=self.github, external_id="42")
            with self.assertRaises(IntegrityError), transaction.atomic():
                ExternalAccount.objects.create(user=make_user(), provider=self.github, external_id="42")
            with self.assertRaises(IntegrityError), transaction.atomic():
                ExternalAccount.objects.create(user=self.u, provider=self.github, external_id="43")
            ExternalAccount.objects.filter(user=self.u).update(revoked_at=timezone.now())
            ExternalAccount.objects.create(user=self.u, provider=self.github, external_id="43")  # apres revocation : autorise

    def test_content_unique_per_provider_and_expiry_is_mandatory(self):
        self.content(ext="same")
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.content(ext="same")
        with self.assertRaises(IntegrityError), transaction.atomic():
            ExternalContent.objects.create(provider=self.tiktok, external_id="n", kind="video", canonical_url="https://x.io", expires_at=None)
