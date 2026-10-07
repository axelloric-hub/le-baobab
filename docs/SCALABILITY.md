# SCALABILITY

Trajectoire visee : 10 k -> 100 k -> 1 M+ utilisateurs sans refonte du modele. Aucun test de charge n'a ete execute : les chiffres ci-dessous sont des **hypotheses de conception**, pas des mesures.

## Points chauds identifies
| Chemin | Risque | Parade actuelle | Etape suivante |
|---|---|---|---|
| Compteur `reaction_count` d'un post viral | verrou de ligne a chaque like | trigger simple, index minimal | desactiver le trigger, compteurs Redis + flush (le mecanisme `incr_counter/drain_counter` existe deja pour les vues) |
| Insertion de messages d'une meme conversation | serialisee par le verrou de `seq` | verrou court ; conversations independantes en parallele | acceptable jusqu'a des milliers de msg/s par conversation ; au-dela, conversation-shard |
| Fan-out d'un auteur populaire | 1 post = N ecritures Redis | seuil 2000 : au-dela, **lecture a la volee** (pull) | seuil adaptatif selon la charge |
| Feed : `visible_posts` | sous-requetes `Exists` | index partiels + re-verification limitee aux IDs candidats | cache de relations dans Redis |
| Table `audit_log`, `messaging_message`, `core_outbox_event` | croissance illimitee | BRIN sur `created_at`, purge outbox (7 j) | **partitionnement** (ci-dessous) |

## Partitionnement futur (non active)
Candidats : `audit_log`, `messaging_message` (hash sur `conversation_id` ou plage mensuelle), `accounts_login_history`, `accounts_login_attempt`, `core_outbox_event`, futures tables `ad_impression/click`. Prealable : cle de partition incluse dans les PK/UNIQUE (`seq` est deja unique par conversation).
Declenchement conseille : > 100 M lignes ou VACUUM > quelques minutes.

## Lectures / ecritures
- Read replicas Supabase pour : explorer, profils publics, stats ; `DATABASES["replica"]` + routeur de lecture (non implemente).
- Pool : `CONN_MAX_AGE=60` + health checks. Avec N conteneurs x M workers, **dimensionner le pooler** (connexions = conteneurs x workers x 1).
- MongoDB : `post_cards` accede par `_id` -> sharding hashed sur `_id` quand > ~100 M documents.
- Redis : separer cache, channel layer et verrous sur des instances distinctes au-dela de ~10 k connexions WebSocket.

## Asynchrone
Outbox relayee toutes les 3 s par un thread interne (une seule instance gratuite). Si la latence de propagation (feed, notifications) devient visible, relayer en continu (worker dedie en conteneur, ou Cloudflare Queues) : les handlers sont deja idempotents.

## Microservices
Ordre d'extraction : messaging -> notifications -> analytics -> advertising. Frontieres deja appliquees : references par UUID, evenements outbox, registre de hooks de moderation.
