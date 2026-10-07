# Politique Redis (Redis Cloud / Upstash / Render Key Value)

| Usage             | DB | Remarque                                                        |
|-------------------|----|-----------------------------------------------------------------|
| Cache / compteurs | 0  | Toute cle doit etre reconstructible                              |
| Channel layer     | 1  | Une eviction de messages ASGI = perte de messages WebSocket      |
| Locks / idempo    | 2  | Ne jamais evincer un verrou en cours                             |

Les services manages n'autorisent souvent qu'UNE politique par instance. Choix retenu :
`maxmemory-policy volatile-lru` -> seules les cles AVEC TTL sont evincables. Toutes nos cles
portent un TTL (voir `apps/core/redis_keys.py`) sauf les compteurs `baobab:cnt:*`, drainés
periodiquement vers PostgreSQL (GETDEL) et donc reconstructibles.
Requis : `appendonly yes`, `appendfsync everysec`, TLS (`rediss://`) + mot de passe.
