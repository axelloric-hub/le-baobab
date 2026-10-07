# MONGODB_ARCHITECTURE

MongoDB n'est utilise que la ou le modele document apporte quelque chose. **3 collections**, specifiees dans `database/mongodb/collections/*.json` (schema, index, patron de lecture/ecriture, embedding, sharding futur, TTL) et appliquees par `manage.py mongo_setup`.

| Collection | Role | Source de verite | Volume | TTL |
|---|---|---|---|---|
| `post_cards` | read-model denormalise d'un post (auteur, medias <= 10, hashtags, compteurs) pour hydrater le feed **sans jointure** | PostgreSQL `social_post` | 1 doc/post | aucun (supprime par `PostDeleted`) |
| `events` | evenements analytiques bruts (acteur, cible, meta libre) | MongoDB (c'est la seule copie : analytique) | tres eleve | `expires_at` (par type, `analytics_event_type.retention_days`) |
| `api_request_logs` | journal de requetes (observabilite, abus) | MongoDB | tres eleve | 30 jours |

## Choix d'embedding
Auteur et medias **embarques** (toujours lus ensemble, bornes, changent rarement). Commentaires **non embarques** : croissance non bornee (risque de depasser 16 Mo) -> PostgreSQL.

## Index (chacun justifie par un patron de lecture, champ `why` dans le JSON)
`post_cards` : `author_recent`, `hashtag_recent` (multikey), `group_recent` (partiel), `recent_public` (partiel). `events` : `ttl_expires`, `type_ts`, `actor_ts` (partiel), `target_ts` (partiel). `api_request_logs` : `ttl_30d`, `correlation`, `route_status_ts`.
Un test impose que **tout index declare sa justification**.

## Validation
`$jsonSchema` (`validationLevel: moderate`, `validationAction: error`) pose via `create_collection` / `collMod`. **Non verifie sur un vrai serveur** : `mongomock` (utilise en test) ignore les validateurs. A executer sur Atlas : `mongo_setup` puis inserer un document invalide et constater le rejet.

## Resilience
Perte totale de `post_cards` = sans consequence : `feed.hydrate()` reprojette depuis PostgreSQL a la volee (teste). `events` n'est pas reconstructible (acceptable : analytique).

## Pipelines
Voir `apps/analytics/pipelines.py` et DATABASE_FUNCTIONS.md.
