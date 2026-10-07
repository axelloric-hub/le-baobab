# DATABASE_SETUP

Pre-requis : PostgreSQL **>= 15** (contraintes `UNIQUE ... NULLS NOT DISTINCT` utilisees), extensions `pg_trgm` et `btree_gist` (creees par les migrations).

## PostgreSQL / Supabase
1. Supabase > New project (region proche des utilisateurs). Noter le mot de passe de la base.
2. Settings > Database > **Connection string**. Deux URL a retenir :
   - `DATABASE_URL_MIGRATIONS` : connexion **directe** (port 5432) ou pooler en mode **session**. Pour `migrate` (verrous de session). **Offre gratuite : preferer le pooler session** (la connexion directe y serait en IPv6 seulement, a verifier) ; voir DEPLOY_FREE.md.
   - `DATABASE_URL` : pooler (`...pooler.supabase.com`). **Mode `session` (5432) recommande.** Mode `transaction` (6543) : exige `DISABLE_SERVER_SIDE_CURSORS` et casse `SET LOCAL`/`set_config` hors transaction — l'audit par trigger (`audit_context`) ne fonctionnerait plus de facon fiable.
3. Extensions : rien a faire a la main (migration `core.0001`). Sur Supabase, `pg_trgm`/`btree_gist` sont disponibles.
4. `python manage.py migrate` : cree 98 tables, **23 fonctions, 28 triggers, 3 vues, 2 vues materialisees, index BRIN/GIN/FTS, contrainte d'exclusion**, puis charge les donnees de reference (pays, types de notification, etc.).
5. Verifier : `python manage.py check_databases` (ou `python scripts/check_databases.py`).
6. Permissions : creer un role applicatif **sans** SUPERUSER ni BYPASSRLS pour la production ; `migrate` utilise un role proprietaire. Django ne depend d'aucune API Supabase (portable RDS/Cloud SQL).

Les objets SQL vivent dans `database/postgres/{functions,triggers,views,indexes}/*.sql`, executes par `apps/dbobjects/migrations/0001`. Ajouter une table avec `updated_at` => rappeler `SELECT baobab_attach_updated_at_triggers()` dans une migration.

## MongoDB
1. Atlas > cluster (M10+ en production ; M0 suffit pour le dev) > Database Access (utilisateur applicatif `readWrite` sur la base `baobab` uniquement) > Network Access.
2. `MONGODB_URL=mongodb+srv://user:***@cluster/?retryWrites=true&w=majority`, `MONGODB_DATABASE=baobab`.
3. `python manage.py mongo_setup` : cree les 3 collections, **validateurs JSON Schema**, **index** (dont TTL). Idempotent (`collMod` si la collection existe).
4. Les specs (schema, index, patterns de lecture/ecriture, sharding futur, TTL) sont dans `database/mongodb/collections/*.json`.

## Redis
1. Redis Cloud / Upstash / autre : creer une base, **TLS actif** (`rediss://`), mot de passe, politique `volatile-lru`, AOF `everysec` (voir `database/redis/policies/redis.conf.md`).
2. `REDIS_URL` (cache, compteurs, verrous, idempotence) et `CHANNEL_REDIS_URL` (channel layer WebSocket) : idealement deux bases logiques ou deux instances.
3. Scripts Lua : charges a la demande depuis `database/redis/scripts/` (aucune etape manuelle).
4. Cles : toujours `baobab:<domaine>:<id>[:<facette>]`, construites uniquement par `apps/core/redis_keys.py`.

## Verification de bout en bout
`python scripts/check_databases.py` verifie : connexions, extensions, tables, fonctions, triggers, vues, index critiques, contrainte d'exclusion, collections et index Mongo, scripts Lua, politique d'eviction Redis. Code de sortie 1 si un controle echoue (utilisable en CI : voir `deploy.yml`).
