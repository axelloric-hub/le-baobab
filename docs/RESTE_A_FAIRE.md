# Ce qui reste à faire

Légende : 🔴 bloque une vraie mise en production · 🟠 important · 🔵 amélioration.
Les failles et interrupteurs de test sont dans `A_NE_PAS_OUBLIER.md`.

## 1. Laissé de côté à ta demande
| Sujet | État | À faire |
|---|---|---|
| 🔴 **Agrégateurs de paiement** (Mobile Money, carte) | Seule la réception d'un webhook signé existe. `POST /payments/start/` crée un paiement « initié » sans fournisseur. | Choisir le fournisseur ; à `start` : appeler son API pour ouvrir une session de paiement puis enregistrer sa référence (`payments.services.attach_provider_ref`) et renvoyer l'URL de paiement au frontend ; faire pointer son webhook vers `/api/v1/payments/webhooks/<provider>/` ; adapter le format du corps/signature du fournisseur dans `ingest_webhook` ; **rembourser chez le fournisseur** (aujourd'hui `process_refund` ne fait que l'écriture comptable) ; réconciliation quotidienne ; secret `PAYMENT_WEBHOOK_SECRET_<PROVIDER>`. |
| 🟠 **Versements aux vendeurs** | Le grand livre calcule le net vendeur (`GET /stores/{slug}/revenue/`) ; **aucun versement** n'est exécuté. | Modèle de paiement des vendeurs (RIB / Mobile Money), seuil, cycle, vérification d'identité (KYC), écritures `payout` au grand livre. |
| 🟠 **GitHub, GitLab, TikTok, YouTube, LinkedIn** | `GET /integrations/providers/` et `/me/integrations/` ne font que lister. Les dépôts du portfolio sont saisis à la main. | OAuth (GitHub/GitLab/LinkedIn), synchronisation des dépôts (API officielles), embeds officiels (oEmbed YouTube/TikTok). Les modèles et le chiffrement des jetons existent déjà. |
| 🟠 **AI Gateway** | Non commencé. | Accès IA en lecture seule aux données (vues SQL dédiées, rôle PostgreSQL en lecture seule, quotas, journalisation). |

## 2. Fonctionnel non livré
- 🔴 **E-mails de notification** : les notifications créent une ligne de livraison `email` mais **seul l'OTP envoie réellement un e-mail**. À faire : worker d'envoi (SMTP déjà configuré), modèles de messages, désinscription, reçus de commande.
- 🟠 **Notifications push** (FCM / Web Push) + endpoint d'enregistrement des appareils (le modèle `Device` existe, pas l'endpoint d'ajout de jeton push).
- 🟠 **Stockage** : calcul de l'empreinte SHA-256 **côté serveur**, analyse antivirus, miniatures d'images, envoi multipart au-delà de 5 Go, nettoyage des fichiers orphelins (non référencés).
- 🟠 **Vérification d'e-mail lors d'un changement d'adresse**, double authentification (2FA), gestion fine des rôles d'administration (aujourd'hui `is_staff` ou rien).
- 🟠 **Administration par API** : suspendre/réactiver un utilisateur, créer un coupon plateforme (le service existe, pas l'endpoint), gérer les référentiels (compétences, métiers).
- 🔵 **Certificats en PDF** (le certificat existe en base, vérifiable par code, mais pas de document).
- 🔵 **Vidéo en streaming** (aujourd'hui : fichier envoyé au bucket) et **exécution de code** pour la correction automatique des questions de type `code`.
- 🔵 **Recherche plein texte** (publications, offres, produits : index SQL prêts, endpoints de recherche non écrits), export des données personnelles (droit d'accès RGPD), messages d'erreur traduits.
- 🔵 **Classroom ↔ organisation** (`organization_ref` existe, pas de logique d'appartenance).

## 3. Technique
- 🟠 **Schéma OpenAPI** : `/api/docs/` ne décrit pas les 271 endpoints (vues fonctionnelles). Générer un schéma depuis le registre `apps.core.api.ROUTES` (déjà utilisé pour `ENDPOINTS_POUR_DEV_BACKEND.txt` et la collection Insomnia).
- 🟠 **Tests de charge** (aucun) et **métriques** (aucune) : Prometheus/Grafana, temps par requête SQL/Redis/Mongo, alertes.
- 🟠 **Performance** : plan d'un cours en une requête (voir `A_NE_PAS_OUBLIER.md` n°7) ; `EXPLAIN` sur des volumes réalistes.
- 🟠 **WebSocket multi-instances** : le channel layer est en mémoire (une instance). Pour plus : Redis comme channel layer + hébergement payant.
- 🟠 **Tâches planifiées hors du processus web** : aujourd'hui elles ne tournent que **pendant l'activité** du service gratuit. Prévoir un déclencheur externe (`POST /internal/jobs/<nom>/`, déjà signé HMAC) ou un service dédié.
- 🔵 CI : `pip-audit`, `bandit`, vérification que `production_ready` est `true` avant un déploiement de production, tests de contrat des événements (versionnage).
- 🔵 Sauvegardes et restauration testées (Supabase, Atlas), journalisation centralisée, Sentry.

## 4. Limites connues du code livré
- Les migrations des domaines **marketplace → advertising** et de `storage` n'ont **jamais tourné sur ton vrai Supabase** : le premier `Migrer` les exécutera. Collection MongoDB `ad_events` idem (Atlas).
- **Aucun vrai SMTP ni vrai bucket n'a été testé** (tests avec un backend e-mail en mémoire et un faux bucket). La signature d'URL S3 est vérifiée hors réseau uniquement.
- MongoDB est **simulé** dans les tests automatiques.
- Le frontend n'existe pas : le comportement navigateur (CORS, envoi direct au bucket, WebSocket derrière Cloudflare Pages) n'a pas été éprouvé.
- Les notes d'audit des axes performance, observabilité et scalabilité restent basses faute de mesures réelles (voir `DATABASE_REVIEW.md`).

## 5. Ordre recommandé
1. Fermer les interrupteurs de test dès qu'un SMTP et un bucket réels fonctionnent (`A_NE_PAS_OUBLIER.md`).
2. Brancher **un** fournisseur de paiement (sandbox d'abord).
3. Envoi réel des e-mails de notification et reçus.
4. Intégrations GitHub / YouTube (lecture) puis TikTok/LinkedIn.
5. Tests de charge + métriques, puis AI Gateway.
