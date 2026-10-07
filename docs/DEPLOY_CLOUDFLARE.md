# DEPLOY_CLOUDFLARE — tout le backend sur Cloudflare, deploye depuis GitHub

> Etat de verification : la config des Workers est **validee par `wrangler` (dry-run)** et typee (`tsc`) ; le serveur Django est teste en configuration production ; les workflows YAML sont syntaxiquement valides.
> **Jamais execute sur un vrai compte Cloudflare** (pas d'identifiants ni de Docker dans mon environnement). La section 9 liste ce que le premier deploiement doit confirmer.

## 1. Ce qu'il faut savoir avant tout

Django, Django Channels, `psycopg` et Redis **ne tournent pas dans un Worker** (runtime V8 : JavaScript/WebAssembly). Les Python Workers (Pyodide) ne conviennent pas a un projet Django + Channels de cette taille, et je n'ai pas pu confirmer la prise en charge des pilotes dont on a besoin.
La voie supportee est **Cloudflare Containers** (disponible sur le plan Workers Paid) : une vraie image Docker, pilotee par un Worker.

Principe officiel : le Worker recoit la requete, la transmet a un **Durable Object** qui demarre/gere le conteneur ; **aucun trafic direct vers le conteneur**, uniquement HTTP via le Worker.

Ce que Cloudflare ne fournit pas ici et qui reste **externe** : PostgreSQL (Supabase), MongoDB (Atlas), Redis (Redis Cloud/Upstash). Le conteneur s'y connecte en sortie (TLS).

## 2. Les 3 services et leurs fichiers

```
                    Internet
                       |
        +--------------v---------------+
        |  Worker "baobab-router" (#1) |   wrangler.router.jsonc  +  workers/router/src/index.ts
        |  aiguille, pose X-Request-ID |
        +---+-------------+------------+
   /ws/*    |   /api /admin /static /health /ready     \  tout le reste
            v             v                               v
 +------------------+ +----------------------------+   Frontend Next.js (Vercel)
 | Worker baobab-ws | | Worker baobab-api          |   (FRONTEND_ORIGIN)
 | WsContainer      | | ApiContainer + cron        |
 | SERVICE_ROLE=ws  | | SERVICE_ROLE=api           |
 +--------+---------+ +-------------+--------------+
          \________ meme image Docker (Dockerfile) _______/
                    Django + Channels (gunicorn + uvicorn)
                              |
            Supabase (PostgreSQL)  MongoDB Atlas  Redis (TLS)
```

| Service (diagramme) | Worker | Config | Code du Worker | Ce qui tourne |
|---|---|---|---|---|
| Cloudflare Worker #1 — Entry Router | `baobab-router` | `wrangler.router.jsonc` | `workers/router/src/index.ts` | JS pur, pas de conteneur |
| Render #1 — Django API | `baobab-api` | `wrangler.api.jsonc` | `workers/api/src/index.ts` | image `Dockerfile`, `SERVICE_ROLE=api` |
| Render #2 — WebSocket | `baobab-ws` | `wrangler.ws.jsonc` | `workers/ws/src/index.ts` | meme image, `SERVICE_ROLE=ws` |
| Render #3 — Cron jobs | **dans `baobab-api`** (`scheduled()` + `triggers.crons`) | `wrangler.api.jsonc` | `workers/api/src/index.ts` | appelle `/internal/jobs/<nom>/` (HMAC) |
| Cloudflare Worker #2 — Proxy/LB | `getRandom(env.API, N)` dans le Worker API | — | `workers/api/src/index.ts` | repartition entre N instances |

Pourquoi le cron est dans le Worker API et non un 4e Worker : un Worker distinct devrait lier la classe de conteneur d'un autre Worker (binding inter-scripts de Durable Object), ce que je n'ai pas pu verifier. Le cron utilise une instance **dediee** (`getContainer(env.API, "cron")`) pour que les instances qui servent les utilisateurs puissent se mettre en veille.

Fichiers cles cote Django : `Dockerfile`, `docker/entrypoint.sh` (choisit `api`/`ws`), `apps/core/internal.py` (jobs signes), `config/settings/production.py` (proxy, hotes, redirections), `.dockerignore`.

## 3. Prerequis (une seule fois)

1. **Compte Cloudflare, plan Workers Paid** (obligatoire pour Containers). Votre domaine doit etre une **zone Cloudflare** (DNS gere par Cloudflare).
2. **Supabase** : projet cree ; noter `DATABASE_URL` (pooler **session**) et `DATABASE_URL_MIGRATIONS` (connexion directe). Voir DATABASE_SETUP.md.
3. **MongoDB Atlas** et **Redis** (TLS) crees.
4. **GitHub** : un depot dont la **racine = le dossier `backend/`** (celui qui contient `Dockerfile` et `wrangler.*.jsonc`).
5. Poste local (pour le tout premier test) : Node >= 22, Docker.

## 4. Jeton API Cloudflare (pour GitHub Actions)

Dashboard > My Profile > API Tokens > Create Token. Partir du modele **Edit Cloudflare Workers**, puis verifier :
- Account : Workers Scripts **Edit**, Account Settings **Read**, et la permission **Containers Edit** si elle existe sous ce nom (si le 1er deploiement repond "permission denied", c'est elle qui manque) ;
- Zone (votre domaine) : Workers Routes **Edit** et DNS **Edit** (necessaires au `custom_domain`).
Noter aussi l'**Account ID** (dashboard > Workers & Pages > colonne de droite).

## 5. Configuration GitHub

Settings > Environments > creer **`staging`** et **`production`**.
- Sur `production` : cocher **Required reviewers** (validation manuelle avant chaque mise en production) et limiter aux branches `main`.
- Dans **chaque** environnement, ajouter ces **Secrets** (valeurs differentes entre staging et production) :

| Secret | Valeur |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | section 4 |
| `DJANGO_SECRET_KEY` | `python -c "import secrets;print(secrets.token_urlsafe(64))"` (>= 50 car.) |
| `INTERNAL_JOB_SECRET` | `python -c "import secrets;print(secrets.token_hex(32))"` |
| `FIELD_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"` |
| `DATABASE_URL` | Supabase pooler (session), `postgresql://...` |
| `DATABASE_URL_MIGRATIONS` | Supabase connexion directe |
| `MONGODB_URL` | `mongodb+srv://...` |
| `REDIS_URL`, `CHANNEL_REDIS_URL` | `rediss://...` (deux bases ou instances) |

Et ces **Variables** (non secretes) : `MONGODB_DATABASE`, et au niveau depot `PUBLIC_HOST_PRODUCTION`, `PUBLIC_HOST_STAGING` (ex. `baobab.example.com`).
Branches : `main` -> production, `develop` -> staging.

## 6. Adapter les fichiers a votre domaine (a faire une fois)

Remplacer `baobab.example.com` / `staging.baobab.example.com` et les URL Vercel dans `wrangler.router.jsonc`, `wrangler.api.jsonc`, `wrangler.ws.jsonc` (champs `routes`, `vars`). Les 3 fichiers doivent rester coherents : `PUBLIC_HOST` = domaine du routeur ; `DJANGO_ALLOWED_HOSTS` doit contenir ce domaine **et** `container`.

## 7. Creer et deployer le routeur (Worker #1) pas a pas

Le routeur est deja ecrit (`workers/router/src/index.ts`). Pour le comprendre ou le recreer :
1. Il a **deux liaisons de service** (`services` dans la config) vers `baobab-api` et `baobab-ws` : appel Worker-a-Worker interne, sans passer par Internet, sans domaine public pour ces deux Workers (`workers_dev: false`).
2. Regles : `/ws/*` -> WS ; `/api/ /admin/ /static/ /health/ /ready/` -> API ; le reste -> `FRONTEND_ORIGIN` (Vercel).
3. Il **supprime** tout `X-Forwarded-*` et `X-Internal-*` venant d'Internet et valide/genere `X-Request-ID`.
4. `routes: [{ pattern, custom_domain: true }]` : Cloudflare cree l'enregistrement DNS et le certificat.

**Ordre obligatoire du tout premier deploiement** (le routeur reference les deux autres par leur nom) :
```bash
npm ci
npx wrangler login
npx wrangler deploy -c wrangler.api.jsonc --env staging      # construit l'image, pousse, cree les conteneurs
npx wrangler deploy -c wrangler.ws.jsonc  --env staging
npx wrangler deploy -c wrangler.router.jsonc --env staging
# secrets (une fois par Worker et par environnement ; la CI le fait ensuite toute seule)
for s in DJANGO_SECRET_KEY DATABASE_URL MONGODB_URL REDIS_URL CHANNEL_REDIS_URL FIELD_ENCRYPTION_KEY INTERNAL_JOB_SECRET; do
  npx wrangler secret put $s -c wrangler.api.jsonc --env staging
  npx wrangler secret put $s -c wrangler.ws.jsonc  --env staging
done
```
**Attendre plusieurs minutes** apres le premier deploiement : le Worker repond avant que les conteneurs soient prets (comportement documente). Puis `curl https://staging.baobab.example.com/ready/` doit renvoyer `{"status":"ready"...}`.

## 8. Deploiement automatique (GitHub Actions)

`.github/workflows/ci.yml` (PR et push) : tests Django (vrais PostgreSQL 16 + Redis), `makemigrations --check`, typage des Workers, validation du routeur, **construction de l'image Docker et demarrage des roles `api` et `ws`**.
`.github/workflows/deploy.yml` (push `main`/`develop` ou lancement manuel) :

```
tests (ci.yml) -> migrate -> deploy API -> deploy WS -> deploy routeur -> test de fumee /ready/
```
- `migrate` : `migrate` + `mongo_setup` + `check_databases`, **une seule fois**, avant le code (jamais dans les conteneurs : N instances ne migrent pas en parallele).
- Les secrets GitHub sont transmis a `wrangler secret` par `cloudflare/wrangler-action` (`secrets:`), puis recopies dans le conteneur par `workers/shared/container-env.ts`. Ils ne sont ni dans l'image ni dans le depot.
- Docker est preinstalle sur `ubuntu-latest` : l'image est construite et poussee par `wrangler deploy`.
- Pourquoi GitHub Actions et pas "Workers Builds" (integration Git du dashboard) : d'apres la doc, Workers Builds ne publie l'image que sur la branche de production ; les autres branches ne font que `versions upload` (pas d'image), et il faudrait 3 projets. Actions permet staging + production + tests + migrations dans un seul flux. Workers Builds reste utilisable si vous preferez, avec un projet par Worker.

**Migrations et retour arriere** : le nouveau code est actif avant la fin du remplacement des conteneurs, donc **toute migration doit etre compatible avec l'ancienne version** du code (ajouter d'abord, supprimer ensuite). Pour revenir en arriere : `git revert` + nouveau deploiement.

## 9. A VERIFIER au premier deploiement (non confirme de mon cote)

| Point | Risque | Test |
|---|---|---|
| **WebSocket** via Worker -> service binding -> Durable Object -> conteneur | non documente dans ce que j'ai lu | `npx wscat -c "wss://staging.../ws/notifications/?token=<jwt>"` ; sinon, realtime a porter sur des Durable Objects natifs |
| **Sortie reseau** du conteneur vers Supabase/Atlas/Redis | filtre eventuel | `/ready/` doit afficher postgres, mongodb, redis `ok:true` |
| **IP de sortie non fixe** | impossible de limiter Atlas/Redis par IP -> mots de passe forts + TLS obligatoires ; ne pas ouvrir sans protection | revue de securite Atlas |
| **Nom d'instance** `standard-1` et ses limites | peut differer | `containers[].instance_type` : verifier la page Limits ; sinon `basic`/`standard-2` |
| **Capacite Afrique** (`AFR` = capacite limitee, **ne peut pas etre exclusif**) | latence via l'Europe | mesurer ; contrainte `regions: ["WEUR","AFR"]` laissee en commentaire |
| **Demarrage a froid** documente 1-3 s pour une image simple ; Django peut etre plus long | 1re requete lente | `sleepAfter` genereux ; mesurer |
| **Permissions du jeton API** (Containers) | echec du 1er deploy | section 4 |
| **`cloudflare/wrangler-action@v3`** : entree `secrets:` | version/syntaxe | lire les logs du 1er run |
| **Cout du cron** : un appel chaque minute garde le conteneur "cron" eveille 24 h/24 (facture au temps d'execution) | cout recurrent | passer `relay-outbox` a `*/5` (cle + `triggers.crons`), ou declencher le relais apres ecriture |
| **Connexions PostgreSQL** : conteneurs x workers | saturation du pooler | `API_INSTANCES`, `WEB_CONCURRENCY`, taille du pooler |

## 10. Exploitation
- **Logs** : `observability.enabled` (logs des Workers) + onglet Containers du dashboard (stdout Django, en JSON avec `correlation_id`). Pour Grafana : Logpush vers un stockage/Loki (non configure).
- **Alertes** : `/ready/` (Cloudflare Health Checks / Better Stack) ; `failed` dans l'outbox (admin Django) ; erreurs `cron job failed` dans les logs Worker.
- **Edge** : ajouter dans Cloudflare > Security > WAF : limitation de debit sur `/api/auth/*` et `/admin/*`, et restriction d'`/admin/` par Cloudflare Access.
- **Verifier un deploiement** : `npx wrangler containers list`, `npx wrangler containers images list`.
- **Local** : `npm run dev:api` (Docker requis ; `r` reconstruit le conteneur). Django seul : `python manage.py runserver`.
