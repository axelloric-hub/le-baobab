import re
from pathlib import Path

import yaml
from django.test import SimpleTestCase

ROOT = Path(__file__).resolve().parent.parent
SITE_SPECIFIC = ("DJANGO_ALLOWED_HOSTS", "CSRF_TRUSTED_ORIGINS", "CORS_ALLOWED_ORIGINS")
PLACEHOLDER = re.compile(r"VOTRE|A-REMPLACER|A REMPLACER|CHANGEME|<.*adresse.*>|TON-SOUS|example\.com", re.I)


class DeployConfigTests(SimpleTestCase):
    """Garde-fou apres une vraie erreur : un `render.yaml` avec des valeurs provisoires ECRASAIT, au push, les bonnes valeurs saisies a la main."""

    def envs(self):
        return {e["key"]: e for e in yaml.safe_load((ROOT / "render.yaml").read_text())["services"][0]["envVars"]}

    def test_site_specific_variables_are_never_hardcoded_in_the_repository(self):
        envs = self.envs()
        for key in SITE_SPECIFIC:
            self.assertIn(key, envs)
            self.assertIs(envs[key].get("sync"), False, f"{key} doit etre sync: false (sinon chaque push ecrase la valeur du tableau de bord)")
            self.assertNotIn("value", envs[key], key)

    def test_no_placeholder_text_in_deployment_files(self):
        for name in ("render.yaml", "wrangler.router.jsonc", ".github/workflows/deploy.yml", ".github/workflows/ci.yml", "Dockerfile", "docker/entrypoint.sh"):
            for n, line in enumerate((ROOT / name).read_text().splitlines(), 1):
                code = line.split("#")[0] if not name.endswith(".jsonc") else line.split("//")[0]
                self.assertIsNone(PLACEHOLDER.search(code), f"{name}:{n} contient un texte provisoire : {line.strip()}")

    def test_test_phase_switches_are_explicit_in_render_yaml(self):
        envs = self.envs()
        for key in ("OTP_DEBUG_ECHO", "PAYMENTS_SIMULATION_ENABLED", "STORAGE_FAKE_AUTO_COMPLETE"):
            self.assertIn(key, envs)
