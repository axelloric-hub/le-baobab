# DEPLOY_FREE — LE BAOBAB a 0 €

> **Pourquoi ce document remplace `DEPLOY_CLOUDFLARE.md`** : Cloudflare Containers (qui faisait tourner Django) exige le plan Workers **payant**. Cette version n'utilise que des offres gratuites.
> **Verifie** : le Worker (dry-run + essai local), le trajet Worker -> Django en config production (secret partage, JWT, WebSocket reels), le planificateur, 151 tests.
> **Jamais execute** sur de vrais comptes Render/Supabase/Atlas/Cloudflare : la section 7 liste ce que le premier deploiement doit confirmer.

## 1. Ce qui est gratuit (et ce que ca coute en contraintes)

| Brique | Service | Limites a connaitre (sources : docs/pages publiques consultees en octobre 2026) |
|---|---|---|
| Django API **+ WebSocket** | **Render** web service gratuit | **veille apres 15 min** sans trafic, **~1 min** pour se reveiller (une nouvelle requete OU connexion WebSocket le reveille) ; **750 h/mois** pour tout le workspace = **un seul service 24h/24** ; systeme de fichiers ephemere ; Render peut le redemarrer a tout moment |
| Redis (cache, WebSocket, compteurs) | **Render Key Value** gratuit | **25 Mo, aucune persistance** (perdu a chaque redemarrage) ; un seul par workspace |
| PostgreSQL | **Supabase** gratuit | **500 Mo**, projet **mis en pause apres 1 semaine d'inactivite** (reactivation manuelle) |
| MongoDB | **Atlas M0** gratuit | quelques centaines de Mo (512 Mo) ; un seul cluster M0 par projet |
| Routeur / CDN | **Cloudflare Workers** gratuit | quota quotidien de requetes (a verifier sur votre compte) ; adresse gratuite `xxx.workers.dev` |
| Frontend | **Vercel** Hobby | usage non commercial |
| CI/CD | **GitHub Actions** | depot public : gratuit ; prive : quota mensuel de minutes (a verifier) |

Ce qui n'est **pas** gratuit et que j'ai donc retire : le cron Render (payant), un 2e service Render (depasserait les 750 h), Cloudflare Containers.

**Consequence pratique** : la premiere requete apres une periode calme attend ~1 minute. C'est acceptable pour un concours/une demo, pas pour une vraie production. Le frontend doit afficher "le serveur demarre..." et **se reconnecter automatiquement** quand le WebSocket tombe.

## 2. Architecture

```
Utilisateur --> Worker Cloudflare "baobab-router" (gratuit)
                 |  /ws/* /api/* /admin/* /static/* /health/ /ready/   (+ secret partage X-Edge-Secret)
                 v
              Render : UN service "baobab-api" (Docker)
                 gunicorn + uvicorn : API REST + WebSocket (Channels) + planificateur interne
                 |        |         |
          Supabase     Atlas M0   Render Key Value (Redis, interne)
          PostgreSQL   MongoDB
                 
                 tout le reste (/) --> Vercel (Next.js)
```

| Ancien element du schema | Maintenant | Fichiers |
|---|---|---|
| Worker #1 routeur | Worker Cloudflare gratuit | `wrangler.router.jsonc`, `workers/router/src/index.ts` |
| Render #1 API + Render #2 WebSocket | **un seul** service Render (l'ASGI sert les deux) | `render.yaml`, `Dockerfile`, `docker/entrypoint.sh` |
| Render #3 cron | thread interne : `apps/core/scheduler.py` (relais outbox toutes les 3 s, vues, purge...) | `apps/core/scheduler.py` |
| Worker #2 proxy / load balancer | supprime (une seule instance gratuite) | — |
| Supabase / MongoDB / Redis | idem (Redis = Key Value de Render) | — |

**Pourquoi un thread plutot qu'un cron** : les evenements ne sont ecrits que pendant une requete, donc quand le service est eveille ; le thread les relaie dans les 3 secondes. Pendant la veille, rien n'est ecrit, rien n'est a relayer. Contrepartie : les jobs periodiques (vues de statistiques, purge) ne tournent que pendant l'activite.

**Securite de l'origine** : l'adresse `xxx.onrender.com` est publique. `EDGE_SHARED_SECRET` fait refuser (403) toute requete HTTP **ou WebSocket** qui ne passe pas par le Worker (teste : acces direct refuse, via le Worker accepte). Seule `/health/` reste ouverte (sonde de Render).

## 3. Creer les comptes (une fois)
1. **GitHub** : un depot dont la **racine = le dossier du projet** (celui qui contient `Dockerfile` et `render.yaml`). Branche `main`.
2. **Supabase** (supabase.com) : New project. Region proche de Render (**Frankfurt** si disponible). Notez le mot de passe.
3. **MongoDB Atlas** (mongodb.com/atlas) : cluster **M0** gratuit. Database Access : un utilisateur `baobab` (mot de passe fort). Network Access : voir l'avertissement ci-dessous.
4. **Render** (render.com) : compte relie a GitHub.
5. **Cloudflare** (cloudflare.com) : compte gratuit. Aucune carte necessaire pour les Workers (a confirmer a l'inscription).
6. **Vercel** : deja prevu pour le frontend.

> Je n'ai pas verifie si Render, Atlas ou Supabase demandent une carte bancaire a l'inscription : regardez avant de commencer.

## 4. Configuration pas a pas

### 4.1 Supabase (PostgreSQL)
Settings > Database > Connection string > onglet **Session pooler** (host `...pooler.supabase.com`, port 5432). Copiez-la : ce sera `DATABASE_URL`.
Pourquoi le pooler : d'apres ce que j'ai lu, la connexion directe gratuite est en IPv6 seulement, alors que GitHub Actions et beaucoup de reseaux sont en IPv4 (**a verifier**). Le mode *session* est obligatoire (pas *transaction*) : l'audit par trigger utilise `set_config`.

### 4.2 Atlas (MongoDB)
Network Access : les IP de sortie de Render gratuit ne sont pas fixes, il faut donc autoriser `0.0.0.0/0`. **Ce n'est acceptable que si** le mot de passe est long et aleatoire et la connexion en TLS (`mongodb+srv://` l'est). Utilisateur limite a la base `baobab` (role `readWrite`).

### 4.3 Premiere migration, depuis VOTRE PC (Windows, invite de commandes)
```bat
cd chemin\vers\le-baobab-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
set DATABASE_URL=postgresql://postgres.xxxx:MOTDEPASSE@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
set DB_SSL_REQUIRE=true
set MONGODB_URL=mongodb+srv://baobab:MOTDEPASSE@cluster0.xxxxx.mongodb.net/
set MONGODB_DATABASE=baobab
python manage.py migrate
python manage.py mongo_setup
```
(`DJANGO_SETTINGS_MODULE` vaut `config.settings.development` par defaut en local.) Ensuite la CI le refera a chaque deploiement.

### 4.4 Render
1. Dashboard > **New > Blueprint** > choisir le depot : Render lit `render.yaml` et propose le service `baobab-api` + le Key Value `baobab-redis`.
2. Renseignez les secrets demandes (`sync: false`) :

| Variable | Valeur |
|---|---|
| `DJANGO_SECRET_KEY` | `python -c "import secrets;print(secrets.token_urlsafe(64))"` |
| `INTERNAL_JOB_SECRET` | `python -c "import secrets;print(secrets.token_hex(32))"` |
| `EDGE_SHARED_SECRET` | `python -c "import secrets;print(secrets.token_hex(32))"` (**la meme valeur** sera mise dans Cloudflare et GitHub) |
| `FIELD_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"` |
| `DATABASE_URL` | l'URL du pooler Supabase (4.1) |
| `MONGODB_URL` | l'URL Atlas |

3. Dans `render.yaml`, remplacez `baobab-router.VOTRE-COMPTE.workers.dev` par l'adresse reelle de votre Worker (apres 4.5) puis poussez.
4. Settings du service > **Deploy Hook** : copiez l'URL (ce sera `RENDER_DEPLOY_HOOK_URL`).
5. Notez l'URL du service (`https://baobab-api.onrender.com`).

### 4.5 Cloudflare Worker (routeur)
```bat
npm ci
npx wrangler login
npx wrangler deploy -c wrangler.router.jsonc
npx wrangler secret put EDGE_SHARED_SECRET -c wrangler.router.jsonc
```
Avant : dans `wrangler.router.jsonc`, mettez `ORIGIN_URL` (URL Render), `FRONTEND_ORIGIN` (URL Vercel) et `PUBLIC_HOST` (l'adresse `baobab-router.<votre-compte>.workers.dev` que `wrangler deploy` affiche ; relancez le deploiement apres correction).
Domaine perso : decommentez `routes` (le DNS de la zone doit etre sur Cloudflare, gratuit).

### 4.6 GitHub : deploiement automatique
Settings > Secrets and variables > Actions :

| Type | Nom | Valeur |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | modele « Edit Cloudflare Workers » |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | dashboard Cloudflare > Workers & Pages |
| Secret | `RENDER_DEPLOY_HOOK_URL` | 4.4 etape 4 |
| Secret | `DATABASE_URL`, `MONGODB_URL`, `DJANGO_SECRET_KEY`, `INTERNAL_JOB_SECRET`, `EDGE_SHARED_SECRET` | memes valeurs que sur Render |
| Variable | `MONGODB_DATABASE` | `baobab` |
| Variable | `PUBLIC_URL` | `https://baobab-router.<compte>.workers.dev` |

Ensuite chaque `git push` sur `main` : tests -> migrations -> deploiement Render -> deploiement Worker -> test de fumee (jusqu'a 20 min : construction Docker + reveil). `keepalive.yml` touche les bases deux fois par semaine pour eviter la pause de Supabase.

## 5. Tester en local avant tout (recommande)
Vous avez deja PostgreSQL, MongoDB, Redis et Docker Desktop : `python manage.py migrate`, `python manage.py check_databases`, `python manage.py runserver`. Cela valide MongoDB, que je n'ai pas pu tester sur un vrai serveur.

## 6. Limites assumees
- **Veille et reveil (~1 min)** ; WebSocket coupe a chaque redemarrage -> reconnexion cote client.
- **Redis perdu a chaque redemarrage** : presence, non-lus chauds, timelines sont reconstruits (c'est le design), mais le fan-out repart de zero ; 25 Mo seulement (les timelines de nombreux utilisateurs peuvent le saturer : baisser `TIMELINE_MAX` dans `apps/social/feed.py`).
- **Un seul service, une seule instance** : pas de montee en charge, pas d'environnement de staging (un 2e service depasserait les 750 h).
- **Supabase 500 Mo / pause** ; **Atlas** ouvert sur `0.0.0.0/0`.
- **Memoire** : l'offre gratuite de Render est petite ; `WEB_CONCURRENCY=1`. Je n'ai pas mesure la consommation reelle (a regarder dans le dashboard au premier deploiement).
- **Builds** : Render gratuit limite les minutes de build (a verifier) ; chaque push sur `main` en consomme.

## 7. A VERIFIER au premier deploiement
| Point | Test |
|---|---|
| `render.yaml` accepte par Render (cles `keyvalue`, `ipAllowList`, `fromService`) | l'import du Blueprint affiche les erreurs |
| Demarrage de l'image avec la memoire gratuite | logs Render ; `/ready/` -> 200 |
| Connexion de Render a Supabase (pooler session), Atlas, Key Value | `/ready/` : postgres, mongodb, redis `ok:true` |
| Reveil par WebSocket **via le Worker** apres veille | se connecter apres 20 min d'inactivite |
| Quota Workers / minutes GitHub / minutes de build | tableaux de bord |
| `cloudflare/wrangler-action@v3` et l'entree `secrets:` | logs du premier run |
| Carte bancaire exigee a l'inscription ? | a l'inscription |

## 8. Quand vous aurez un peu de budget
Par ordre d'effet : Render **Starter (7 $/mois)** supprime la veille (et le reveil d'une minute) ; Supabase **Pro (25 $/mois)** supprime la pause. Rien dans le code ne change.
