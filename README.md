# LE BAOBAB — backend (fondation data)

African Developer Platform — Connect · Learn · Build · Grow.
Monolithe modulaire Django (DRF + Channels) sur **PostgreSQL (Supabase) + MongoDB (Atlas) + Redis**, deploye **gratuitement** : Render (Django) + Cloudflare Worker (routeur) + GitHub Actions.

## Etat
**Backend complet** : 22 domaines, **API REST v1 de 278 endpoints** (`docs/ENDPOINTS_POUR_DEV_BACKEND.txt`), **441 tests** (PostgreSQL et Redis reels), 190+ entites documentees. Fichiers par URL signee (jamais via l'API), isolation stricte entre comptes, OTP par SMTP.
core, accounts, profiles, friends, community, messaging, social (posts, statuts, feed hybride), notifications, audit, moderation, integrations, analytics,
**education** (classrooms, cours payants par module/chapitre), **assessments** (quiz, devoirs), **progress** (progression, certificats),
**marketplace** (catalogue, commandes, licences), **payments** (grand livre equilibre, remboursements, webhooks), **companies**, **portfolio**, **jobs** (emplois + freelance), **advertising**.
Migrations et `/ready/` valides sur de vrais Supabase, Atlas et Upstash jusqu'au domaine education ; **les derniers domaines n'ont pas encore ete deployes**.
**Non realise** : AI Gateway, fournisseurs de paiement reels, GitHub/GitLab/TikTok/YouTube/LinkedIn (voir `docs/RESTE_A_FAIRE.md`). **Avant la production : `docs/A_NE_PAS_OUBLIER.md`** (interrupteurs de test a couper). Tests a la main : `docs/INSOMNIA_TESTS.md`. Voir `docs/DATABASE_REVIEW.md` (notes honnetes : plusieurs axes restent sous 90, avec la raison et la mesure manquante).

## Demarrage local
```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # puis renseigner (PostgreSQL, Redis ; MongoDB optionnel en dev)
python manage.py migrate        # schema + fonctions/triggers/vues + donnees de reference
python manage.py mongo_setup    # collections + index MongoDB
python manage.py check_databases
DJANGO_SETTINGS_MODULE=config.settings.testing python manage.py test
python manage.py runserver
```
Tests : PostgreSQL 16 et Redis requis en local (`baobab/baobab` sur `localhost`, Redis db 15) ; MongoDB simule.

## Carte du depot
| Chemin | Contenu |
|---|---|
| `apps/` | 12 domaines Django + `dbobjects` (objets SQL) |
| `database/postgres`, `mongodb`, `redis` | SQL versionne, specs Mongo, scripts Lua, politique Redis |
| `config/` | settings (base/development/production/testing), ASGI/WSGI, routage WebSocket |
| `Dockerfile`, `docker/entrypoint.sh` | image unique, role choisi par `SERVICE_ROLE` |
| `workers/`, `wrangler.router.jsonc`, `package.json` | Worker routeur (Cloudflare, plan gratuit) |
| `render.yaml` | Blueprint Render (service Django + Redis, plan gratuit) |
| `.github/workflows/` | CI et deploiement automatique |
| `docs/` | architecture, setup, dictionnaire (genere), fonctions, securite, scalabilite, Mongo, Redis, **DEPLOY_FREE**, review |
| `scripts/` | `check_databases.py`, `gen_data_dictionary.py` |

**Pour deployer (gratuit) : `docs/DEPLOY_FREE.md`.**
