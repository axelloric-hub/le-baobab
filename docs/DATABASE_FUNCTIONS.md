# DATABASE_FUNCTIONS

Sources : `database/postgres/**`, `database/redis/scripts/*.lua`, `apps/analytics/pipelines.py`.
Principe : triggers **courts, previsibles, sans logique metier** ; la logique est dans les services Python.

## Fonctions PostgreSQL
| Nom | Objet | Retour | Pourquoi en SQL |
|---|---|---|---|
| `baobab_set_updated_at()` | trigger : `updated_at = now()` | trigger | couvre les UPDATE hors ORM |
| `baobab_attach_updated_at_triggers()` | pose le trigger sur toute table ayant `updated_at` | int | rejouable apres chaque migration |
| `baobab_forbid_mutation(cols...)` | rend une table append-only ; autorise seulement la mise a NULL de FK listees (`ON DELETE SET NULL`) | trigger | l'audit est inalterable **par la base** |
| `baobab_trg_*` (8) | compteurs : reactions, commentaires (+soft delete), reactions de commentaire, partages, sauvegardes, votes, hashtags, membres de groupe | trigger | coherence meme hors ORM |
| `baobab_message_assign_seq()` | attribue `seq` gapless par conversation (verrou de ligne sur la conversation) | trigger | ordre total, pagination curseur |
| `baobab_message_thread_counter()` / `baobab_message_immutable_keys()` | compteur de thread ; `seq`/`conversation_id` immuables | trigger | integrite |
| `baobab_audit_row(pk, exclus...)` | journal par ligne (diff minimal old/new, acteur/IP/correlation via `set_config`) ; ignore les colonnes secretes | trigger | capture toute modification |
| `baobab_are_friends(a,b)` | amitie acceptee ? | bool | lecture SQL / futur AI Gateway |
| `baobab_group_has_permission(user,group,code)` | droit effectif | bool | idem |
| `baobab_feed_score(age_h, reactions, comments, shares, affinity)` | score de classement (parite testee avec Python) | float | tri/analyses SQL |
| `baobab_unread_count(conv,user)` | non-lus | bigint | O(1) |
| `baobab_user_stats(user)` | posts/abonnes/amis/groupes | table | profil |
| `baobab_recount_post_counters(post?)` | reconstruit les compteurs derives | int | reparation apres incident |
| `baobab_refresh_daily_metrics(day)` | UPSERT des agregats quotidiens | int | cron |
| `baobab_housekeeping(batch)` | purge par lots : idempotence expiree, outbox traitee > 7 j, tentatives de connexion > 90 j | jsonb | cron |

## Triggers (28)
`trg_set_updated_at` (toutes tables), 8 compteurs, 3 messagerie, 3 append-only (`audit_log`, `audit_admin_action`, `moderation_action`), 6 audit de lignes (`accounts_user`, `profiles_profile`, `profiles_privacy`, `community_group_ban`, `community_group_role`, `moderation_restriction`).

## Vues
`v_user_statistics`, `v_group_statistics`, `v_moderation_queue` (toujours a jour) ; **materialisees** `mv_platform_daily` (refresh horaire) et `mv_trending_hashtags` (refresh 10 min), rafraichies `CONCURRENTLY` (index unique present) par `manage.py refresh_materialized_views`.

## Contrainte d'exclusion
`excl_restriction_no_overlap` : un utilisateur ne peut avoir qu'une suspension/ban actif a la fois. Le service remplace l'ancienne sanction (historique conserve).

## Pipelines MongoDB (`apps/analytics/pipelines.py`)
`trending_hashtags`, `top_posts_by_engagement`, `top_authors_by_engagement` (sur `post_cards`) ; `daily_event_counts`, `daily_active_actors` (DAU en deux `$group`), `user_interest_signals` (entree du futur moteur de recommandation) (sur `events`). Fonctions pures : testees sans base.

## Scripts Redis (Lua, atomiques)
`rate_limit` (fenetre glissante), `lock_release` (compare-and-delete), `lock_extend`, `capped_incr` (frequency capping), `idempotency_acquire` (acquired/in_progress/mismatch/done).

## Commandes d'exploitation
`relay_outbox`, `flush_counters`, `refresh_metrics`, `refresh_materialized_views`, `housekeeping`, `mongo_setup`, `check_databases`. Planifiees en production par le planificateur interne `apps/core/scheduler.py` (voir DEPLOY_FREE.md) ; `/internal/jobs/<nom>/` (HMAC) permet aussi de les declencher depuis un cron externe.
