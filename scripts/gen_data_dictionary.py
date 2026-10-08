#!/usr/bin/env python
"""Genere docs/DATA_DICTIONARY.md depuis les modeles Django (source unique de verite) : python scripts/gen_data_dictionary.py"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
import django  # noqa: E402

django.setup()
from django.apps import apps  # noqa: E402

TRUTH = {
    "accounts": ("PostgreSQL", "identite, securite du compte"), "profiles": ("PostgreSQL", "profil, referentiels, confidentialite"),
    "friends": ("PostgreSQL", "graphe social (amis, abonnements, blocages)"), "community": ("PostgreSQL", "communautes, groupes, roles, channels"),
    "messaging": ("PostgreSQL", "messages (ordre total par `seq`) ; Redis = presence/typing/non-lus chauds seulement"),
    "social": ("PostgreSQL", "posts/commentaires/reactions/statuts ; MongoDB `post_cards` = read-model ; Redis = timeline + vues"),
    "notifications": ("PostgreSQL", "liste, preferences, livraisons ; Redis = compteur non-lus"), "audit": ("PostgreSQL", "journal inalterable (triggers)"),
    "moderation": ("PostgreSQL", "signalements, dossiers, sanctions, journal immuable"), "integrations": ("PostgreSQL", "comptes/contenus externes (tokens chiffres)"),
    "education": ("PostgreSQL", "classrooms, cours, modules/chapitres (prix par niveau), blocs de contenu, inscriptions, droits d'acces"),
    "assessments": ("PostgreSQL", "quiz (correction auto), devoirs, groupes, grille de notation, notes"),
    "progress": ("PostgreSQL", "progression par chapitre (module/cours calcules en SQL), certificats verifiables"),
    "marketplace": ("PostgreSQL", "catalogue, panier, commandes (prix figes), licences, avis"),
    "payments": ("PostgreSQL", "paiements, grand livre equilibre et inalterable, remboursements, webhooks dedoublonnes"),
    "companies": ("PostgreSQL", "entreprises, membres et roles, verification"),
    "portfolio": ("PostgreSQL", "projets, depots, experiences, formations, certificats affiches"),
    "jobs": ("PostgreSQL", "offres, candidatures (machine a etats), entretiens, offres d'embauche, freelance, contrats, jalons"),
    "advertising": ("PostgreSQL + Redis + MongoDB", "annonceurs, campagnes, ciblage (liste blanche), portefeuille ; evenements bruts en Mongo `ad_events` ; plafonds en Redis"),
    "analytics": ("PostgreSQL + MongoDB", "catalogue d'evenements + agregats (PG) ; evenements bruts (Mongo `events`)"), "core": ("PostgreSQL", "outbox, idempotence"),
}


def ftype(f):
    t = f.get_internal_type()
    if getattr(f, "max_length", None):
        t += f"({f.max_length})"
    if f.is_relation:
        t = f"FK -> {f.related_model._meta.label}" if f.many_to_one or f.one_to_one else t
    return t


lines = ["# DATA_DICTIONARY", "", "> Genere automatiquement par `scripts/gen_data_dictionary.py` depuis les modeles. Ne pas editer a la main.", ""]
for label in TRUTH:
    cfg = apps.get_app_config(label)
    src, desc = TRUTH[label]
    lines += [f"## {label}", "", f"**Source of truth :** {src} — {desc}", ""]
    for m in cfg.get_models():
        o = m._meta
        lines += [f"### `{o.db_table}` ({m.__name__})", "", (m.__doc__ or "").strip().split("\n")[0], "",
                  "| Champ | Type | Null | Unique | Defaut |", "|---|---|---|---|---|"]
        for f in o.concrete_fields:
            d = f.default if f.has_default() and not callable(f.default) else ("(fonction)" if f.has_default() else "")
            lines.append(f"| `{f.name}` | {ftype(f)} | {'oui' if f.null else 'non'} | {'PK' if f.primary_key else ('oui' if f.unique else '')} | {d} |")
        for f in o.many_to_many:
            lines.append(f"| `{f.name}` | M2M -> {f.related_model._meta.label} | - | - | - |")
        if o.constraints:
            lines += ["", "**Contraintes :** " + " ; ".join(f"`{c.name}`" for c in o.constraints)]
        if o.indexes:
            lines += ["", "**Index :** " + " ; ".join(f"`{i.name}`" for i in o.indexes)]
        lines.append("")
(ROOT / "docs").mkdir(exist_ok=True)
(ROOT / "docs" / "DATA_DICTIONARY.md").write_text("\n".join(lines))
n = sum(len(list(apps.get_app_config(a).get_models())) for a in TRUTH)
print(f"{n} entites documentees")
