# DATABASE_REVIEW — audit de la tranche 1

Scores = jugement honnete sur **ce qui existe aujourd'hui**, pas sur le perimetre vise. **Le cahier des charges exigeait >= 90 partout avant de considerer la phase terminee : ce n'est PAS le cas** ; les ecarts sont listes.

| Axe | /100 | Pourquoi | Ce qui manque pour 90+ |
|---|---|---|---|
| Modelisation | 68 | 86 entites coherentes, contraintes DB (CHECK/UNIQUE/exclusion), frontieres par UUID/evenements | **domaines absents** : education, marketplace/paiements, jobs/freelance/portfolio/companies, advertising |
| PostgreSQL | 88 | 23 fonctions, 28 triggers, vues (mat.), BRIN/GIN/FTS/partiels, migration SQL reversible, `EXPLAIN` verifie dans les tests | `EXPLAIN` sur jeu de donnees realiste (> 1 M lignes), partitionnement pret mais non active |
| MongoDB | 70 | specs completes, index justifies, pipelines testes, perte de `post_cards` recuperable | **jamais execute sur un vrai MongoDB** (validateurs JSON Schema non verifies) |
| Redis | 88 | primitives atomiques en Lua testees sur vrai Redis, TTL verifie par test, tout est reconstructible | politique d'eviction non verifiee sur le service cible ; `SCAN` dans `flush_counters` |
| Securite | 78 | audit inalterable, autorisation en SQL, secrets chiffres/valides, HMAC interne | pas de pentest, pas de `pip-audit`, 2FA/verification e-mail/reset non faits, pas de RLS |
| Performance | 72 | index partiels, pagination curseur, EXPLAIN cibles | **aucun test de charge** ; compteurs de ligne chaude connus (voir SCALABILITY.md) |
| Scalabilite | 78 | fan-out hybride, outbox, SKIP LOCKED, plan de partitionnement | non mesuree ; read replicas non implementes |
| Maintenabilite | 85 | apps a responsabilite claire, services/selectors, 151 tests, dictionnaire genere | couche API (vues/URLs) absente ; admin non teste |
| Observabilite | 62 | correlation ID, logs JSON, `/ready/`, journal `SystemEvent`, endpoint de sante des 3 bases | pas de metriques (Prometheus/Grafana), pas de timing DB/Redis/Mongo par requete |
| Preparation microservices | 80 | UUID inter-domaines, outbox, registre de hooks, aucun import circulaire | FK restantes entre `social`/`community`/`friends` ; contrats d'evenements non versionnes |

## Defauts trouves et corriges pendant la construction (tous couverts par un test)
Cache de permissions non invalide a l'adhesion ; demande d'ami rejetee a tort ; preference de notification `NULL` jamais appliquee (`IN (x, NULL)`) ; evenement analytique rejete en boucle (acteur requis pour une paire) ; contexte d'audit qui fuyait dans la transaction englobante ; index (conversation, -seq) redondant ; **`argon2-cffi` et `whitenoise` absents de `requirements.txt` (aurait plante l'image de production)** ; YAML des workflows invalide.

## Limites connues
- Tests : PostgreSQL et Redis **reels** ; MongoDB **simule** (`mongomock`) ; WebSocket teste en memoire (pas via Cloudflare).
- Le deploiement (Render, Supabase, Atlas, Cloudflare) n'a **jamais ete execute** sur de vrais comptes (voir DEPLOY_FREE.md section 7). Le trajet Worker -> Django (secret partage, JWT, WebSocket) a ete teste en local.
