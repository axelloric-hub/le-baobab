# ⚠️ À NE PAS OUBLIER — avant toute mise en production

Ce fichier liste ce qui est **volontairement ouvert pendant la phase de test** et les faiblesses connues. Rien ici n'est caché : tout est à fermer ou à décider **avant d'accueillir de vrais utilisateurs ou de vrais paiements**.

## Le rappel automatique
`GET /api/v1/admin/system/status/` (compte administrateur) renvoie **`"production_ready": false`** tant qu'un interrupteur de test est actif, avec la liste et le risque de chacun. Le serveur écrit aussi un avertissement `INTERRUPTEUR DE TEST ACTIF …` dans les journaux Render à chaque démarrage, et `python manage.py check --deploy` les signale. **Objectif avant la production : `production_ready: true`.**
(Ces interrupteurs ne sont volontairement **pas** annoncés par `/ready/`, qui est public.)

## Tableau des points ouverts

| # | Point | Gravité | Comment le fermer | Comment vérifier |
|---|---|---|---|---|
| 1 | **Le code OTP affiché à l'écran** permet de valider un compte sans posséder l'adresse e-mail. *Test uniquement, à désactiver avant la production.* | 🔴 **Élevée si oubliée** | Render → Environment → `OTP_DEBUG_ECHO` = `false`. Configurer un vrai SMTP (`EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`). | `POST /auth/register/` : la réponse ne contient **plus** `debug_code`. |
| 2 | **L'endpoint qui simule un paiement réussi** (`PAYMENTS_SIMULATION_ENABLED`) permet d'obtenir des produits sans payer. *Test uniquement.* | 🔴 **Élevée si oubliée** | `PAYMENTS_SIMULATION_ENABLED` = `false`. | `POST /payments/{id}/simulate/` → **404**. |
| 3 | **`STORAGE_FAKE_AUTO_COMPLETE`** accepte un envoi de fichier sans le vérifier (et `STORAGE_BACKEND=fake` ne stocke rien). *Test uniquement.* | 🔴 **Élevée si oubliée** | `STORAGE_FAKE_AUTO_COMPLETE` = `false` ; `STORAGE_BACKEND` = `s3` ; renseigner `STORAGE_ENDPOINT_URL`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`. | `POST /files/{id}/complete/` sans avoir envoyé le fichier → **422 `upload_missing`**. |
| 4 | **Limites par IP inefficaces tant que le routeur n'est pas mis à jour** : l'API ne voit que l'IP de Cloudflare/Render, donc les limites par IP (connexion, OTP, téléchargements) sont partagées entre tous les utilisateurs. | 🟠 Moyenne | **Redéployer le routeur** : Cloudflare → *Workers & Pages* → `baobab-router` → *Create deployment* → déposer le nouveau `routeur-pages.zip` (il transmet l'IP réelle du client dans `X-Client-IP` et ignore toute fausse valeur envoyée par un client — testé). | `GET /me/login-history/` affiche **votre vraie IP**, pas celle de Cloudflare. |
| 5 | **L'inscription révèle qu'une adresse e-mail est déjà utilisée** par un compte confirmé (`409 email_taken`). | 🟡 Faible | À décider : réponse neutre (« si l'adresse est libre, un code est envoyé ») au prix d'une moins bonne ergonomie. | — |
| 6 | **L'empreinte SHA-256 des logiciels vendus est fournie par le vendeur**, pas calculée par le serveur. **Aucun antivirus** sur les fichiers envoyés. Le type du fichier est celui déclaré par le client. | 🟠 Moyenne | Calculer l'empreinte côté serveur après l'envoi (worker dédié) et analyser les fichiers (ClamAV ou service d'analyse) avant de les rendre téléchargeables. | — |
| 7 | **Le plan d'un cours calcule l'accès chapitre par chapitre** (beaucoup de requêtes pour un gros cours). | 🔵 Performance | Calculer l'accès en une seule requête SQL pour tout le cours. | Temps de réponse de `GET /courses/{id}/` sur un cours de 100 chapitres. |
| 8 | ~~Un jeton d'accès reste valable après une suspension de compte~~ | ✅ **Vérifié : réglé** | — | **Testé** : un compte suspendu ou anonymisé reçoit **401 immédiatement**, même avec un jeton encore signé (`tests/test_api_hardening.py`). |
| 9 | **L'envoi direct par URL signée et la taille signée n'ont pas été testés sur un vrai Cloudflare R2.** Il faudra aussi **configurer le CORS du bucket**. | 🟠 À vérifier | Voir « CORS du bucket » ci-dessous, puis un envoi réel depuis Insomnia (PUT binaire) et depuis un navigateur. | Étape 3 du guide Insomnia avec `STORAGE_BACKEND=s3`. |

## CORS du bucket (Cloudflare R2 → bucket → *Settings* → *CORS Policy*)
```json
[
  {
    "AllowedOrigins": ["https://baobab-router.pages.dev"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
Remplacez l'origine par l'adresse **réelle** du frontend (celle que voit le navigateur). Sans CORS, l'envoi direct échoue dans le navigateur (mais pas dans Insomnia).

## Autres rappels de sécurité
- **JWT** : en test, `JWT_ACCESS_LIFETIME_MINUTES=120` (dans `render.yaml`). **Remettre 15 en production.**
- **Compte administrateur** : une fois créé (`ensure_admin`), **supprimez le secret GitHub `ADMIN_PASSWORD`** (le mot de passe n'est défini qu'à la création ; il n'a plus besoin de rester stocké). Pas de double authentification sur les comptes administrateurs.
- **Secrets déjà exposés** : le mot de passe MongoDB Atlas collé dans une conversation doit être **changé** (secret GitHub `MONGODB_URL` **et** variable Render).
- **MongoDB Atlas est ouvert à `0.0.0.0/0`** (inévitable sans IP fixe) : la protection repose sur un mot de passe long.
- **Quotas gratuits** : 25 e-mails OTP par jour en test ; Upstash 500 000 commandes/mois ; Supabase met la base en pause après 1 semaine sans activité ; Render s'endort après 15 min (les tâches planifiées — relais d'événements, règlement publicitaire, expiration des commandes — ne tournent que **pendant l'activité**).
- **Notifications par e-mail** : les lignes de livraison sont créées mais **seul l'OTP envoie réellement un e-mail** (voir `RESTE_A_FAIRE.md`).

## Check-list avant la production (à cocher)
- [ ] `OTP_DEBUG_ECHO=false` · [ ] `PAYMENTS_SIMULATION_ENABLED=false` · [ ] `STORAGE_FAKE_AUTO_COMPLETE=false` · [ ] `STORAGE_BACKEND=s3`
- [ ] `GET /admin/system/status/` → `"production_ready": true`
- [ ] SMTP réel testé (un vrai code reçu) · [ ] bucket réel testé (envoi navigateur + CORS)
- [ ] Routeur redéployé (IP réelle visible) · [ ] `JWT_ACCESS_LIFETIME_MINUTES=15`
- [ ] Un fournisseur de paiement branché et son webhook signé testé (`RESTE_A_FAIRE.md`)
- [ ] Mot de passe MongoDB changé · [ ] secret `ADMIN_PASSWORD` supprimé de GitHub
- [ ] Test d'intrusion / analyse des dépendances (`pip-audit`) · [ ] test de charge
