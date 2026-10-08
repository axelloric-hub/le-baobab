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

## Fonctions du domaine education (`006_education.sql`)
| Nom | Objet | Retour |
|---|---|---|
| `baobab_chapter_unlocked(user, chapter)` | chapitre gratuit OU droit valide (non expire, non revoque) sur le chapitre, son module, son cours ou sa classroom | bool |
| `baobab_module_progress(user, module)` / `baobab_course_progress(user, course)` | chapitres publies termines / total, pourcentage, temps passe (module/cours = **calcul**, aucune donnee derivee a maintenir) | table |
| `baobab_quiz_best_percent(user, quiz)` | meilleur score en % parmi les tentatives corrigees | numeric |
| `baobab_course_leaderboard(course, limit)` | classement (chapitres termines puis temps), egalites = meme rang | table |
Vues ajoutees : `v_store_statistics`, `v_job_statistics`, `v_company_statistics`, `v_campaign_statistics`. Vue `v_course_statistics` (inscriptions, taux d'achevement, certificats, droits actifs). Audit par trigger sur `education_entitlement`, `progress_certificate`, `assessments_grade`, `education_enrollment`.
La regle d'acces payant a UNE seule definition (la fonction SQL) ; `apps.education.access` l'appelle, il n'y a pas de duplication Python.

## Fonctions du commerce (`007_commerce.sql`)
| Nom | Objet |
|---|---|
| `baobab_trg_review_rating()` | note moyenne d'un produit maintenue a l'insertion, a la modification de la note et a la suppression d'un avis |
| `baobab_ledger_check_batch()` | **trigger differe** : tout lot d'ecritures du grand livre somme a ZERO et ne melange pas les devises, sinon la transaction est refusee |
| `baobab_order_ledger_balance(order)` | solde de toutes les ecritures d'une commande (doit valoir 0) |
| `baobab_store_revenue(store, from, to)` | revenus d'une boutique calcules depuis le grand livre (brut, rembourse, net) |

## Fonctions du recrutement (`008_opportunities.sql`)
| Nom | Objet |
|---|---|
| `baobab_company_requires_owner()` | **trigger differe** : une entreprise a toujours au moins un proprietaire (transfert possible dans une seule transaction) |
| `baobab_job_funnel(job)` | entonnoir : nombre de candidatures par statut |
Contrainte d'exclusion `excl_slot_no_overlap` : deux creneaux d'entretien d'un meme recruteur ne peuvent pas se chevaucher. Historique des candidatures en ecriture seule.

## Fonctions de la publicite (`009_advertising.sql`)
| Nom | Objet |
|---|---|
| `baobab_adwallet_check()` | **trigger differe** : solde du portefeuille == somme de son journal, que l'on modifie l'un ou l'autre |
| `baobab_campaign_settled_micro(campaign)` | depense reglee d'une campagne (micro-unites) |
Le portefeuille ne peut pas etre negatif (`CHECK`), le journal et les reglements sont en ecriture seule, le ciblage est limite a une liste blanche (`CHECK`).

## Triggers (28 + 4 education)
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
