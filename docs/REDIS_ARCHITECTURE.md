# REDIS_ARCHITECTURE

Redis = **acceleration et temps reel, jamais verite**. Construction des cles uniquement via `apps/core/redis_keys.py` (prefixe `baobab:`). **Un test verifie que toutes les cles ecrites par les primitives ont un TTL.**

| Cle | Type | TTL | Usage | Reconstruction |
|---|---|---|---|---|
| `baobab:user:{id}:presence` | string | 90 s (heartbeat ~30 s) | en ligne/hors ligne | naturelle |
| `baobab:conversation:{id}:typing` | zset (score = expiration) | 12 s | indicateur de frappe | ephemere |
| `baobab:conversation:{id}:unread` | hash user -> n | 7 j | non-lus chauds | `message_seq - last_read_seq` (PG) |
| `baobab:user:{id}:notif:unread` | string | 7 j | compteur non-lus | recompte PG a l'absence |
| `baobab:user:{id}:perms:g:{gid}` | string JSON | 120 s | permissions de groupe | PG ; invalide a l'adhesion/sourdine/ban |
| `baobab:feed:{uid}` | zset (post_id, ts) <= 800 | 24 h | timeline fan-out | `feed.rebuild_timeline` |
| `baobab:feed:celebrities` | set | — | auteurs servis en lecture directe | repeuple au fan-out |
| `baobab:rate_limit:{scope}:{id}` | zset | fenetre | limitation de debit | ephemere |
| `baobab:lock:{res}:{id}` | string | 30 s | verrou distribue | ephemere |
| `baobab:idem:{scope}:{key}` | string | 24 h | verrou court d'idempotence | **la base fait foi** |
| `baobab:cnt:post_view:{id}` | string | — | compteur de vues, vide par `GETDEL` chaque minute | perte max = 1 minute de vues |
| `baobab:dedup:post_view:{post}:{viewer}` | string | 1 h | une vue/heure/viewer | ephemere |
| `baobab:ad:freq:{ad}:{user}:{jour}` | string | 24 h | plafond de frequence publicitaire | ephemere |
| `baobab:ad:gate:{campagne}:{jour}` / `gate_total:{campagne}` | string (micro-unites) | 2 j / 400 j | garde-fou de budget temps reel (INCRBY atomique puis controle) ; le total est reinitialise depuis PostgreSQL | PG (`AdSettlement`) |
| `baobab:ad:acc:{annonce}:{jour}` | hash | 3 j | accumulateur impressions/clics/conversions/depense avant reglement | ephemere : RENAME vers un lot puis application en base |
| `baobab:ad:settling:{lot}:{annonce}:{jour}` | hash | — | lot en cours de reglement (rejouable apres plantage) | supprime APRES commit |
| `baobab:ad:dedupe:{imp|click|conv}:{id}` | string | 24 h / 7 j | un evenement ne compte qu'une fois | ephemere |
| `baobab:asgi:*` | channel layer | 10 s | WebSocket (Django Channels) | ephemere |

## Scripts Lua (atomiques)
`rate_limit`, `lock_release` (n'efface que si proprietaire), `lock_extend`, `capped_incr`, `idempotency_acquire`. Tous testes contre un vrai Redis.

## Politique
`volatile-lru` + AOF `everysec` + TLS + mot de passe. Les verrous sont des **optimisations** : l'invariant est toujours garanti par une contrainte UNIQUE ou `select_for_update`.

## Limites assumees
- **Offre gratuite (Upstash) : 500 000 commandes/mois.** Chaque requete applicative coute plusieurs commandes (cache de permissions, limitation de debit, compteurs) : surveiller le quota. Le **channel layer WebSocket n'utilise pas Redis** en offre gratuite (memoire du processus, une seule instance) : Django Channels interroge Redis en permanence par connexion, ce qui epuiserait le quota.
- `flush_counters` utilise `SCAN` : acceptable a l'echelle actuelle ; au-dela, tenir un set des IDs "sales".
- Un seul `REDIS_URL` pour cache/verrous : separer du channel layer en production.
- Sans `CONFIG`, le controle de la politique d'eviction est impossible sur certains services manages : verifier chez le fournisseur.
