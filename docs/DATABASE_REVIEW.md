# DATABASE_REVIEW — audit final de la couche data

Scores = jugement honnete sur **ce qui existe et a ete verifie**. Le cahier des charges exigeait >= 90 partout : **ce n'est pas atteint**, et ce document dit pourquoi, axe par axe. Gonfler une note sans la preuve correspondante serait faux ; les axes sous 90 ne montent qu'avec des **mesures reelles** (charge, metriques, audit externe), pas avec du code supplementaire.

## Ce qui a ete verifie, et sur quoi
- **Tests automatises : 394**, sur PostgreSQL 16 et Redis **reels** (concurrence reelle par threads : achats, paiements, remboursements, candidatures, creneaux, clics). MongoDB est **simule** (`mongomock`) en test.
- **Sur de vrais services** (Supabase, Atlas, Upstash, Render, Cloudflare) : migrations jusqu'au domaine *education* (voir historique), `mongo_setup`, et `/ready/` = les trois bases connectees.
- **Pas encore verifie sur de vrais services** : les migrations des domaines marketplace, payments, companies, portfolio, jobs, advertising (ecrites apres le dernier deploiement), et la collection MongoDB `ad_events`. Le prochain `Migrer` sera leur premiere execution reelle.

## Inventaire mesure (base locale migree)
36 fonctions SQL · 45 triggers · 8 vues + 2 vues materialisees · 2 contraintes d'exclusion · 183 tables metier · 118 contraintes `CHECK` · 834 index · 175 entites documentees (`DATA_DICTIONARY.md`, genere depuis les modeles).

| Axe | /100 | Pourquoi | Ce qui manque pour 90+ |
|---|---|---|---|
| Modelisation | 86 | tous les domaines demandes sont modelises (identite, social, messagerie, education, marketplace, paiements, emplois/freelance, portfolio, entreprises, publicite, moderation, audit, analytics) ; invariants en base (somme du grand livre nulle, solde = journal, proprietaire d'entreprise, exclusion de creneaux, liste blanche de ciblage) | **AI Gateway** non fait ; signaux de recommandation seulement prepares ; pas de partitionnement actif |
| PostgreSQL | 89 | 36 fonctions, 45 triggers dont 6 **differes** (invariants verifies au commit), index partiels/BRIN/FTS/exclusion, migrations reversibles et rejouables | `EXPLAIN` sur des volumes realistes (> 1 M lignes) ; migrations recentes non rejouees sur Supabase |
| MongoDB | 78 | 4 collections specifiees (schema, index justifies, TTL) ; creation validee sur Atlas pour les 3 premieres | pipelines et requetes jamais executes sur un vrai serveur ; `ad_events` non encore cree sur Atlas |
| Redis | 84 | primitives atomiques (Lua) testees sur vrai Redis ; plafonds de frequence/budget temps reel ; tout reconstructible | politique d'eviction non verifiable sur Upstash ; quota 500 000 commandes/mois ; WebSocket en memoire (1 instance) |
| Securite | 82 | OTP e-mail hache avec plafond quotidien, URL de fichiers signees (type et taille) avec isolation par proprietaire, jetons refuses des la suspension (teste), webhooks HMAC dedoublonnes, grand livre/portefeuille/journaux en ecriture seule, anti-fraude des clics, ciblage par liste blanche, aucun secret commercial dans les serializers (teste), origine verrouillee | interrupteurs de test a couper (voir A_NE_PAS_OUBLIER.md), pas de pentest, pas de `pip-audit`, 2FA / verification e-mail / reset non faits, pas de RLS, **aucun fournisseur de paiement integre** |
| Performance | 72 | index partiels, pagination curseur, EXPLAIN cibles | **aucun test de charge** ; lignes chaudes connues (voir SCALABILITY.md) |
| Scalabilite | 76 | fan-out hybride, outbox `SKIP LOCKED`, reglement publicitaire par lots, plan de partitionnement | **une seule instance gratuite** par conception ; non mesuree |
| Maintenabilite | 89 | 394 tests (dont ~100 d'API avec verification d'isolation entre comptes), dictionnaire et documentation d'API generes depuis le code, decouplage par evenements/registres, admin sans liste illisible | schema OpenAPI des endpoints non genere ; aucun vrai SMTP/bucket teste |
| Observabilite | 62 | correlation ID, logs JSON, `/ready/`, `SecurityEvent`/`SystemEvent` (paiement orphelin, montant falsifie, webhook non signe) | pas de metriques ni de tableau de bord, pas de timing par requete DB/Redis/Mongo |
| Preparation microservices | 85 | references par UUID entre domaines, evenements outbox, registres (moderation, cibles vendables), commerce <-> education sans import | quelques FK restantes entre domaines proches ; contrats d'evenements non versionnes |

## Defauts trouves pendant la construction (tous couverts par un test)
Cache de permissions non invalide a l'adhesion · demande d'ami rejetee a tort · preference de notification `NULL` jamais appliquee (`IN (x, NULL)`) · evenement analytique rejete en boucle · contexte d'audit qui fuyait · index redondant · dependances absentes de `requirements.txt` · YAML invalide · nom de conteneur de CI invalide · `SELECT ... FOR UPDATE` refuse sur jointure externe (aurait casse les quiz) · panier cree avec une quantite 0 · remboursement d'un produit sans licence (formation) · lecture de `NEW` dans un trigger de suppression (PL/pgSQL) · contrainte « clics <= impressions » qui aurait fait echouer un reglement le lendemain d'une impression · plusieurs tests creux (`if False`) detectes et remplaces.

## Limites connues
- MongoDB simule en test ; WebSocket teste en memoire puis en local derriere le routeur, pas sur Cloudflare Pages reel.
- Offre gratuite : veille de ~1 min, une instance, Redis a quota, base Supabase mise en pause apres 1 semaine sans activite.
- Les jobs periodiques (relais outbox, reglement publicitaire, expiration des commandes) tournent **dans le processus web** : ils ne s'executent que pendant l'activite.
