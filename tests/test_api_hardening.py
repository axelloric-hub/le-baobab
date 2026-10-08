from django.test import RequestFactory, override_settings

from apps.accounts.models import User
from apps.core.api import client_ip
from apps.core.api_testing import api_client, verified_user
from apps.core.testing import BaobabTestCase


class HardeningTests(BaobabTestCase):
    def test_a_suspended_account_loses_access_immediately_even_with_a_valid_token(self):
        u = verified_user("suspendu")
        c = api_client(u)
        self.assertEqual(c.get("/api/v1/me/").status_code, 200)
        User.objects.filter(pk=u.pk).update(status="suspended", suspension_reason="abus")
        self.assertEqual(c.get("/api/v1/me/").status_code, 401)  # le jeton d'acces reste signe, mais l'utilisateur n'est plus actif : refuse tout de suite
        from apps.accounts.services import anonymize_user
        User.objects.filter(pk=u.pk).update(status="active", suspension_reason="")
        anonymize_user(user=User.objects.get(pk=u.pk))
        self.assertEqual(c.get("/api/v1/me/").status_code, 401)

    @override_settings(EDGE_SHARED_SECRET="s" * 40)
    def test_client_ip_comes_from_the_trusted_edge_header_only_when_the_edge_is_configured(self):
        rf = RequestFactory()
        r = rf.get("/", HTTP_X_CLIENT_IP="41.202.1.9", REMOTE_ADDR="10.0.0.1")
        self.assertEqual(client_ip(r), "41.202.1.9")
        self.assertEqual(client_ip(rf.get("/", REMOTE_ADDR="10.0.0.1")), "10.0.0.1")

    @override_settings(EDGE_SHARED_SECRET="")
    def test_without_an_edge_secret_a_forged_ip_header_is_ignored(self):
        r = RequestFactory().get("/", HTTP_X_CLIENT_IP="6.6.6.6", REMOTE_ADDR="10.0.0.1")
        self.assertEqual(client_ip(r), "10.0.0.1")  # sans routeur de confiance, l'en-tete est falsifiable : on ne l'utilise pas

    def test_every_registered_endpoint_declares_its_authentication_and_unknown_routes_are_404(self):
        from apps.core.api import ROUTES
        import config.urls  # noqa: F401  (charge toutes les routes)

        self.assertGreater(len(ROUTES), 150)
        self.assertEqual({r["auth"] for r in ROUTES} - {"public", "optional", "user", "staff"}, set())
        self.assertEqual(api_client().get("/api/v1/n-importe-quoi/").status_code, 404)
        for r in ROUTES:  # aucun endpoint d'ecriture n'est anonyme sauf ceux de connexion/webhook/verification publique
            if r["method"] != "GET" and r["auth"] == "public":
                self.assertTrue(r["path"].startswith(("auth/", "payments/webhooks/")), r["path"])
