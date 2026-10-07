# DATABASE_REVIEW — audit

Scores = jugement honnete sur **ce qui existe et a ete verifie**, pas sur le perimetre vise. Le cahier des charges exigeait >= 90 partout : **ce n'est PAS atteint** ; l'ecart est detaille axe par axe. Gonfler une note sans la preuve correspondante serait faux.

## Ce qui a ete verifie sur de VRAIS services (et non simule)
Migrations PostgreSQL (fonctions, triggers, vues, contrainte d'exclusion) sur **Supabase** ; creation des collections, validateurs JSON Schema et index sur **MongoDB Atlas** (`mongo_setup`) ; connexion des trois bases par `/ready/` (Supabase, Atlas, Upstash) apres deploiement sur **Render** derriere un routeur **Cloudflare**. 204 tests sur PostgreSQL 16 et Redis reels (MongoDB simule en test).

| Axe | /100 | Pourquoi | Ce qui manque pour 90+ |
|---|---|---|---|
| Modelisation | 78 | 100+ entites, contraintes en base (prix, cibles uniques, exclusion), education complete (prix par module/chapitre, droits idempotents, quiz, devoirs, certificats) | **marketplace/paiements, jobs/freelance/portfolio/companies, advertising** non faits |
| PostgreSQL | 89 | 28 fonctions, 32 triggers, vues, index partiels/BRIN/FTS, migrations reversibles, valide sur Supabase reel | `EXPLAIN` sur > 1 M lignes ; partitionnement non active |
| MongoDB | 78 | creation du schema/validateurs/index **valide sur Atlas reel** ; pipelines testes sur simulateur | pipelines et patrons de lecture jamais executes sur un vrai serveur |
| Redis | 84 | primitives atomiques (Lua) testees sur vrai Redis ; Upstash connecte | politique d'eviction non verifiable sur Upstash ; quota 500 000 commandes/mois ; WebSocket en memoire |
| Securite | 80 | audit inalterable, autorisation en SQL, origine verrouillee (secret edge), HMAC interne, certificats a verification limitee, corrections de quiz jamais exposees (teste) | pas de pentest, pas de `pip-audit`, 2FA / verification e-mail / reset non faits, pas de RLS |
| Performance | 72 | index partiels, pagination curseur, EXPLAIN cibles | **aucun test de charge** ; lignes chaudes connues (voir SCALABILITY.md) |
| Scalabilite | 76 | fan-out hybride, outbox `SKIP LOCKED`, plan de partitionnement | **une seule instance gratuite** par conception ; non mesuree |
| Maintenabilite | 87 | 204 tests (concurrence incluse), dictionnaire genere, responsabilites claires | couche API (vues/URLs) absente |
| Observabilite | 62 | correlation ID, logs JSON, `/ready/`, journal `SystemEvent` | pas de metriques ni de tableau de bord, pas de timing par requete DB/Redis/Mongo |
| Preparation microservices | 82 | references par UUID entre domaines, evenements outbox, registre de hooks | quelques FK restantes entre domaines proches ; contrats d'evenements non versionnes |

## Defauts trouves pendant la construction (tous couverts par un test)
Cache de permissions non invalide a l'adhesion ; demande d'ami rejetee a tort ; preference de notification `NULL` jamais appliquee (`IN (x, NULL)`) ; evenement analytique rejete en boucle ; contexte d'audit qui fuyait ; index redondant ; `argon2-cffi`/`whitenoise` absents de `requirements.txt` ; YAML invalide ; nom de conteneur de CI invalide ; **`SELECT ... FOR UPDATE` refuse par PostgreSQL sur une jointure externe (aurait casse tous les quiz)**.

## Limites connues
- Tests : PostgreSQL et Redis reels ; MongoDB simule ; WebSocket teste en memoire puis en local derriere le routeur (pas sur Cloudflare Pages reel).
- Offre gratuite : veille de ~1 min, une instance, Redis a quota, base Supabase mise en pause apres 1 semaine sans activite.
