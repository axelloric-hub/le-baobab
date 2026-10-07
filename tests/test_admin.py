from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import TestCase


class AdminSmokeTests(TestCase):
    """Chaque modele enregistre dans l'admin doit avoir une liste qui se charge (colonnes/filtres/recherche valides)."""

    def test_every_registered_changelist_loads(self):
        User = get_user_model()
        su = User.objects.create_superuser(email="root@example.com", username="root_admin", password="S3cure-pass-phrase!")
        self.client.force_login(su)
        failures = []
        for model, model_admin in admin.site._registry.items():
            if not model._meta.app_label.startswith(("education", "assessments", "progress", "accounts", "profiles", "friends", "community", "messaging",
                                                      "social", "notifications", "audit", "moderation", "integrations", "analytics", "core")):
                continue
            url = f"/admin/{model._meta.app_label}/{model._meta.model_name}/"
            r = self.client.get(url, {"q": "x"})
            if r.status_code != 200:
                failures.append((url, r.status_code))
        self.assertEqual(failures, [])
        self.assertGreater(len(admin.site._registry), 80)
