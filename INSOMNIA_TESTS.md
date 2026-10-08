# Tester LE BAOBAB avec Insomnia — guide complet

> Tout se teste **sans frontend**, par l'adresse du routeur Cloudflare (le `.dev` / `.pages.dev`), jamais par `onrender.com` (elle refuse l'accès direct).
> Les 271 requêtes sont déjà prêtes dans `insomnia_collection.json`. Ce guide dit **dans quel ordre** les lancer et **quoi vérifier**.

## 0. Avant de commencer (une seule fois)

1. **Importer la collection** : Insomnia → *Application* (ou *Create*) → **Import** → `insomnia_collection.json`. Si Insomnia refuse le fichier, suivez le guide à la main : toutes les URL et tous les corps sont donnés plus bas.
2. **Environnement de base** : ouvrez *Manage Environments*. Vérifiez `base_url` = `https://baobab-router.pages.dev` (ou votre adresse `.workers.dev`).
3. **Quatre personnages** (sous-environnements déjà créés : *Alice*, *Bob*, *Prof*, *Admin*). Chacun a ses propres `access` et `refresh`. **Changer de personnage = changer d'environnement** (menu en haut). C'est ce qui permet de tester l'isolation entre comptes.
4. **Prérequis serveur (phase de test)** sur Render : `OTP_DEBUG_ECHO=true`, `PAYMENTS_SIMULATION_ENABLED=true`, `STORAGE_BACKEND=fake`, `STORAGE_FAKE_AUTO_COMPLETE=true` (déjà dans `render.yaml`). Vérifiez avec l'étape 11 que le serveur répond.
5. **Le réveil** : le service gratuit s'endort après 15 min ; la première requête peut prendre ~1 minute (timeout Insomnia à 60 s : relancez).

### Astuce : récupérer le jeton automatiquement
Dans l'environnement du personnage, champ `access` : tapez `Ctrl+Espace` → **Response ⇒ Body Attribute** → choisissez la requête `POST auth/login` (ou `verify-email`), filtre `$.access`, *Trigger Behavior* : **Always**. Faites pareil pour `refresh` (`$.refresh`). Le jeton se met à jour tout seul à chaque connexion.
Sans l'astuce : copiez `access` et `refresh` de la réponse dans l'environnement du personnage.

### Lire une réponse
- Succès : JSON direct. Listes : `{"next": ..., "previous": ..., "results": [...]}` (suivre `next` tel quel).
- Erreur : toujours `{"error": {"code": "...", "message": "...", "fields": {...}}}`. **Se fier à `code`.**
- **404 = « n'existe pas OU vous n'avez pas le droit de le voir »** : c'est voulu (anti-fuite).

---

## 1. Inscription avec OTP (personnage : Alice)

| # | Requête | Corps | À vérifier |
|---|---|---|---|
| 1 | `POST /api/v1/auth/register/` | `{"email":"alice@example.com","username":"alice","password":"Un-mot-de-passe-solide-2026!","display_name":"Alice"}` | 201 · `user.status = "pending"` · `otp.email_sent` · **`otp.debug_code`** (6 chiffres, phase de test) |
| 2 | `POST /api/v1/auth/login/` | e-mail + mot de passe | **403** `email_not_verified` (compte pas encore confirmé) |
| 3 | `POST /api/v1/auth/verify-email/` | `{"email":"alice@example.com","code":"<debug_code>"}` | 200 · `access` + `refresh` · `user.status = "active"` → **copier dans l'environnement Alice** |
| 4 | `GET /api/v1/me/` | — | 200 · votre profil complet |

**Cas à essayer**
- Mauvais code ×5 → `422 otp_invalid` (essais restants), puis `422 otp_locked` même avec le bon code → il faut un nouveau code.
- Redemander un code (`POST /auth/resend-otp/` `{"email":"alice@example.com"}`) **avant 60 s** → `429 otp_cooldown`. Après 60 s → nouveau code (l'ancien ne marche plus).
- Mot de passe faible (`"123"`) → `400 validation_error` avec `fields.password`.
- **Quota de 25 e-mails/jour** : au-delà, `otp.email_sent = false`, `otp.reason = "daily_quota_reached"` — mais `debug_code` reste affiché en phase de test.
- **SMTP non configuré** : `otp.reason = "email_failed"`, `debug_code` affiché. Pour tester le vrai envoi, renseigner `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` sur Render.
- État du quota : environnement *Admin* → `GET /api/v1/admin/system/status/` (champ `otp.emails_sent_today`).

Refaites l'étape 1 pour **Bob** (`bob@example.com`, `bob`), puis **Prof** (`prof@example.com`, `prof`).

## 2. Session : refresh, déconnexion, mot de passe oublié
1. `POST /auth/token/refresh/` `{"refresh":"{{ _.refresh }}"}` → nouveau `access` **et nouveau `refresh`** (rotation). Rejouer l'**ancien** refresh → **401**.
2. `POST /auth/logout/` `{"refresh":"…"}` → 204 ; ce refresh ne marche plus.
3. `POST /auth/password/forgot/` `{"email":"alice@example.com"}` → réponse identique que le compte existe ou non (anti-énumération) ; `debug_code` seulement si le compte existe.
4. `POST /auth/password/reset/` `{"email":…, "code":…, "new_password":"Nouveau-mot-de-passe-9!"}` → toutes les sessions sont révoquées (les anciens refresh donnent 401).
5. 11 mauvaises connexions de suite → **429** `login_rate_limited`, même avec le bon mot de passe (blocage 15 min).

## 3. Profil et fichiers (Alice)
1. `PATCH /me/profile/` `{"display_name":"Alice B.","headline":"Dev Django","country":"CM","languages":["fr","en"]}`.
2. `PUT /me/skills/` `{"skills":[{"slug":"django","level":4}]}` (référentiels : `GET /skills/`, `/interests/`, `/professions/`, `/countries/`).
3. **Envoyer un avatar (3 étapes, les fichiers ne passent pas par l'API) :**
   - `POST /files/uploads/` `{"purpose":"avatar","filename":"moi.png","content_type":"image/png","size_bytes":1000}` → notez `file_id` et `url`.
   - **Mode test (`STORAGE_BACKEND=fake`)** : sautez l'envoi (l'URL est fictive). **Avec un vrai bucket** : requête `PUT <url>` dans Insomnia, corps *Binary File*, en-tête `Content-Type: image/png`.
   - `POST /files/{{file_id}}/complete/` → `status: "uploaded"`.
   - `PATCH /me/profile/` `{"avatar_file":"<file_id>"}` → `avatar_url` renseigné. Remplacer l'avatar supprime l'ancien objet.
4. Tests d'isolation : avec **Bob**, `GET /files/<file_id d'Alice>/url/` → **404** ; `PATCH /me/profile/ {"avatar_file":"<file_id d'Alice>"}` → **422 invalid_file** ; un SVG (`image/svg+xml`) → 422 `invalid_content_type`.
5. Profil public : `GET /users/alice/` (sans jeton) → 200. `PATCH /me/privacy/ {"profile_visibility":"friends"}` puis Bob ou sans jeton → **404** ; redevenir `public`.

## 4. Amis, blocage (Alice ↔ Bob)
1. Alice : `POST /friends/requests/` `{"username":"bob"}` → copier `id`.
2. Bob : `GET /friends/requests/` (1 demande) → `POST /friends/requests/{{request_id}}/respond/` `{"accept":true}`.
3. Alice : `GET /friends/` → `bob`. **Prof** tente de répondre à la demande → refusé (403/404).
4. Bob : `POST /users/alice/block/` → Alice ne voit plus `GET /users/bob/` (**404**), et inversement.

## 5. Publications et confidentialité (Alice, Bob, Prof)
1. Alice : `POST /posts/` `{"kind":"text","body":"Bonjour #django","visibility":"public"}` → `id` public. Refaites avec `"visibility":"friends"` (→ `id_amis`) et `"private"` (→ `id_prive`).
2. **Matrice à vérifier** (`GET /posts/{id}/`) :

| Qui | public | amis | privé |
|---|---|---|---|
| Alice | 200 | 200 | 200 |
| Bob (ami) | 200 | 200 | **404** |
| Prof (inconnu) | 200 | **404** | **404** |
| sans jeton | 200 | **404** | **404** |

3. Bob : `POST /posts/{id}/reactions/` `{"type":"like"}` ; `POST /posts/{id}/comments/` `{"body":"Bravo"}` ; Prof tente la même chose sur le post « amis » → **404**.
4. `GET /feed/` (Bob) : voit les posts d'Alice (le feed se construit en ~3 s après publication). `GET /hashtags/trending/`.
5. Média d'un post : envoyer d'abord un fichier (`purpose: "post_media"`, étape 3), puis `POST /posts/` avec `"media":[{"file":"<file_id>","alt":"capture"}]`. Le fichier d'un autre compte → **422 invalid_file**.
6. Sondage : `{"kind":"poll","body":"Quel framework ?","poll":{"question":"Lequel ?","options":["Django","Flask"]}}` puis `POST /posts/{id}/poll/vote/` `{"options":["<id option>"]}`.
7. Statut éphémère : `POST /statuses/` `{"kind":"text","body":"en ligne","visibility":"friends"}` ; `GET /statuses/` côté Bob (visible) et Prof (vide).

## 6. Groupes et messagerie
1. Alice : `POST /groups/` `{"name":"Django CM","slug":"django-cm","privacy":"public","join_policy":"approval"}`.
   Bob : `POST /groups/django-cm/join/` → `pending` ; Alice : `GET /groups/django-cm/join-requests/` → `POST /group-join-requests/{{id}}/review/` `{"approve":true}`.
   Groupe **caché** : `{"privacy":"hidden","join_policy":"invite_only"}` → Prof reçoit **404** sur `GET /groups/<slug>/`.
2. Messagerie : Alice `POST /conversations/direct/` `{"username":"bob"}` → `conversation_id`.
   Alice : `POST /conversations/{{conversation_id}}/messages/` `{"body":"Salut Bob","client_msg_id":"<un uuid>"}` — **renvoyez la même requête** : même `id` (idempotent).
   Bob : `GET /conversations/` (non-lus = 1) → `GET .../messages/` → `POST .../read/` `{"up_to_seq":1}`.
   **Prof** : `GET /conversations/{{conversation_id}}/messages/` → **404** ; envoyer → **403**.
3. WebSocket (hors Insomnia classique) : `wss://<routeur>/ws/conversations/<id>/?token=<access>` (Insomnia accepte les requêtes *WebSocket*). Envoyer `{"type":"heartbeat"}` ; Prof est refusé (fermeture 4403).

## 7. Cours payant, achat, accès, remboursement (Prof = enseignant/vendeur, Bob = étudiant, Admin)
**Prof prépare :**
1. `POST /classrooms/` `{"title":"Dev Africa","slug":"dev-africa"}`
2. `POST /classrooms/dev-africa/courses/` `{"title":"Django","slug":"django"}` → `course_id`
3. `POST /courses/{{course_id}}/modules/` `{"title":"Avancé","is_free":false,"price_minor":9000,"currency":"XAF"}` → `module_id`
4. `POST /modules/{{module_id}}/chapters/` `{"title":"ORM","is_free":false,"price_minor":5000,"currency":"XAF"}` → `chapter_id`
5. `POST /chapters/{{chapter_id}}/blocks/` `{"kind":"text","body":"Contenu payant"}`
6. `POST /courses/{{course_id}}/publish/`
7. `POST /stores/` `{"name":"Boutique","slug":"boutique"}` → `POST /stores/boutique/products/` `{"kind":"course","slug":"orm","title":"ORM avancé"}` → `product_id`
8. `POST /products/{{product_id}}/variants/` `{"sku":"ORM-1","name":"Accès","price_minor":5000,"currency":"XAF"}` → `variant_id`
9. `POST /products/{{product_id}}/entitlement-targets/` `{"scope":"chapter","target_id":"{{chapter_id}}"}` · `POST /products/{{product_id}}/publish/`

**Bob achète :**
1. `POST /courses/{{course_id}}/enroll/` → 201.
2. `GET /chapters/{{chapter_id}}/content/` → **402** `payment_required` (le frontend sait qu'il faut proposer l'achat).
3. `POST /cart/items/` `{"variant":"{{variant_id}}","quantity":1}` → `POST /checkout/` `{"idempotency_key":"<un uuid>"}` → `order.id` (rejouer avec la même clé : même commande).
4. `POST /payments/start/` `{"order":"{{order_id}}","provider":"manual"}` → `payment_id`.
5. `POST /payments/{{payment_id}}/simulate/` `{"outcome":"succeeded"}` → commande `paid` *(désactivé en production : voir A_NE_PAS_OUBLIER.md)*.
6. Attendre ~3 s (le droit d'accès est accordé par événement) puis `GET /chapters/{{chapter_id}}/content/` → **200** avec le contenu.
7. **Alice** (non inscrite au cours) : `GET /chapters/{{chapter_id}}/content/` → **403** `enroll_required` ; `GET /orders/{{order_id}}/` avec Alice → **404** (la commande de Bob n'existe pas pour elle). *(Prof, lui, a toujours accès : il est l'enseignant.)*
8. Remboursement : Bob `POST /refunds/` `{"order_item":"<id de la ligne>","reason":"erreur"}` → Admin `GET /admin/refunds/` puis `POST /admin/refunds/{{refund_id}}/decision/` `{"approve":true}` → après ~3 s, le contenu redevient **402**.
9. Contrôle comptable (Admin) : `GET /admin/ledger/orders/{{order_id}}/` → `balance: 0`. Vendeur : `GET /stores/boutique/revenue/`.

**Quiz et devoirs** : `POST /courses/{{course_id}}/quizzes/` → `POST /quizzes/{{id}}/questions/` (`{"kind":"single","prompt":"2+2 ?","choices":[{"label":"4","is_correct":true},{"label":"5"}]}`) → `POST /quizzes/{{id}}/publish/` `{"published":true}`. Bob : `GET /quizzes/{{id}}/` (aucune bonne réponse dans la réponse), `POST /quizzes/{{id}}/attempts/`, `POST /attempts/{{id}}/submit/`. Un non-inscrit reçoit **404**.

## 8. Application vendue, licence, téléchargement
Prof : fichier (`purpose:"product_asset"`, `application/zip`) → `POST /products/{{id}}/releases/` `{"version":"1.0.0","platform":"windows","assets":[{"file":"<file_id>","checksum_sha256":"<64 hex>"}]}` → publier. Bob : acheter (étape 7.3 à 7.5) → `GET /me/licenses/` → `POST /assets/{{asset_id}}/download/` → URL signée. Sans licence → **403**.

## 9. Entreprises, emplois, freelance
1. Prof : `POST /companies/` `{"name":"Afrik Tech","slug":"afrik-tech"}` ; `POST /companies/afrik-tech/members/` `{"username":"alice","role":"recruiter"}`.
2. Alice (recruteuse) : `POST /jobs/` `{"company":"afrik-tech","title":"Dev Django","description":"<au moins 50 caractères>","job_type":"full_time","contract_type":"permanent","skills":[{"slug":"django"}]}` → `job_id` → `POST /jobs/{{job_id}}/publish/`.
3. Bob : `POST /jobs/{{job_id}}/apply/` `{"cover_letter":"Motivé !"}` (un CV : fichier `purpose:"cv"` → `cv_file`). Une 2e candidature → **409**. Un compte **sans lien avec l'entreprise** (inscrivez-en un 4e, *Carol*) : `GET /applications/{{id}}/` → **404**. *(Prof est propriétaire de l'entreprise et Admin est administrateur : tous deux ont le droit de la voir.)*
4. Alice : `POST /applications/{{id}}/transition/` `{"to_status":"reviewing"}` puis `shortlisted` (sauter une étape → `422 invalid_transition`).
5. Alice : `POST /jobs/{{job_id}}/slots/` (créneau) ; Bob : `POST /applications/{{id}}/book/` `{"slot":"…"}` ; Alice : `POST /applications/{{id}}/offer/` `{"amount_minor":500000,"currency":"XAF"}` ; Bob : `POST /offers/{{id}}/respond/` `{"accept":true}` → `GET /me/contracts/`.
6. Freelance : `POST /jobs/` avec `"job_type":"freelance","contract_type":"freelance"` (sans entreprise) → proposition `POST /jobs/{{id}}/proposals/` → acceptation `POST /proposals/{{id}}/accept/` → jalons `POST /milestones/{{id}}/advance/` (`start`/`submit` par le prestataire, `approve` par le client).

## 10. Portfolio
`POST /me/portfolio/projects/` `{"slug":"baobab","title":"LE BAOBAB","technologies":["django"]}` · `PATCH /me/portfolio/` `{"visibility":"private"}` → sans jeton `GET /users/alice/portfolio/` = **404**. Une date de fin avant la date de début → **422**.

## 11. Administration et publicité (Admin)
1. **Créer l'administrateur** : ajoutez les secrets GitHub `ADMIN_EMAIL`, `ADMIN_PASSWORD` (et la variable `ADMIN_USERNAME`), poussez : le workflow exécute `ensure_admin`. Connectez-vous (`/auth/login/`) → jeton dans l'environnement *Admin*.
2. `GET /api/v1/admin/system/status/` → **`production_ready: false`** tant que les interrupteurs de test sont actifs (liste dans `test_flags_active`).
3. Publicité : Alice `POST /ads/accounts/` `{"name":"Annonceur","currency":"XAF"}` → Admin `POST /admin/ads/accounts/{{id}}/topup/` `{"amount_minor":50000,"reference":"v1"}` (rejouer = pas de double crédit) → Alice : campagne, groupe d'annonces (`"rules":[{"field":"skill","values":["django"]}]` ; `"religion"` est refusé), création, annonce, `submit` → Admin : `GET /admin/ads/review-queue/` puis `POST /admin/ads/{{id}}/review/` `{"approve":true}` → Alice `activate`.
4. Bob (après `PUT /me/skills/` `{"skills":[{"slug":"django","level":3}]}`) : `GET /ads/serve/?placement=feed` → l'annonce + `impression_id` → `POST /ads/impressions/` → `POST /ads/clicks/`. Le règlement des dépenses tourne toutes les 5 min : `GET /ads/campaigns/{{id}}/stats/`.
5. Modération : Bob `POST /reports/` `{"target_type":"post","target_id":"<post>","reason":"spam"}` → Admin `GET /admin/moderation/cases/` → `POST …/{{case_id}}/actions/` `{"action":"hide","reason":"spam avéré"}` → le post devient 404 pour les autres.

## 12. Webhook signé (simulation du fournisseur de paiement)
Corps (sans espace superflu) : `{"event_id":"e1","provider_ref":"<provider_ref de /payments/start/>","status":"succeeded","amount_minor":5000,"currency":"XAF"}`
Signature : `echo -n '<le corps exact>' | openssl dgst -sha256 -hmac "<PAYMENT_WEBHOOK_SECRET_MANUAL>"` → en-tête `X-Signature`.
Ajoutez d'abord `PAYMENT_WEBHOOK_SECRET_MANUAL` (une valeur longue de votre choix) dans Render > Environment. Sans secret configuré → **403** (voulu). Rejouer le même `event_id` → `{"duplicate": true}`.

## Check-list d'isolation (à cocher)
- [ ] Un identifiant d'une autre personne (post privé, commande, candidature, fichier, conversation, rendu, campagne) renvoie **404** — jamais son contenu.
- [ ] Un étudiant ne voit que ses propres rendus ; un candidat que ses candidatures ; un annonceur que ses campagnes.
- [ ] Les endpoints `admin/...` donnent **401** sans jeton, **403** avec un jeton non administrateur.
- [ ] Une réponse destinée au client ne contient jamais : commission, net vendeur, stock exact, enchère, budget, ciblage, bonnes réponses d'un quiz.
