"""Interrupteurs de TEST : tant qu'un seul est actif, l'application n'est PAS prete pour la production. Rappel automatique au demarrage et dans `manage.py check --deploy`."""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.checks import Tags, Warning, register

log = logging.getLogger(__name__)

TEST_FLAGS = {
    "OTP_DEBUG_ECHO": "le code OTP est renvoye dans la reponse : n'importe qui peut valider un compte sans posseder l'adresse e-mail",
    "PAYMENTS_SIMULATION_ENABLED": "POST /payments/{id}/simulate/ est actif : on peut obtenir des produits sans payer",
    "STORAGE_FAKE_AUTO_COMPLETE": "la fin d'envoi d'un fichier est acceptee sans verification du bucket",
}


def active_test_flags() -> dict[str, str]:
    flags = {k: v for k, v in TEST_FLAGS.items() if getattr(settings, k, False)}
    if getattr(settings, "STORAGE_BACKEND", "s3") == "fake":
        flags["STORAGE_BACKEND=fake"] = "les fichiers ne sont pas reellement stockes (aucun bucket)"
    return flags


@register(Tags.security, deploy=True)
def test_flags_check(app_configs, **kwargs):
    return [Warning(f"Interrupteur de TEST actif : {name} - {why}.", hint="Voir A_NE_PAS_OUBLIER.md avant la mise en production.", id=f"baobab.W00{i}")
            for i, (name, why) in enumerate(active_test_flags().items(), start=1)]


def warn_at_startup() -> None:
    if settings.DEBUG:
        return
    for name, why in active_test_flags().items():
        log.warning("INTERRUPTEUR DE TEST ACTIF %s : %s", name, why)
