# Espace membre — lot 1 (Accueil, Statuts, Publication)

Pages réservées aux membres connectés, intégrées à partir des maquettes Stitch du lot 1 et branchées sur l'API réelle. **Aucune donnée de démonstration** : tout ce qui s'affiche vient du serveur ; un bloc sans données ne s'affiche pas (ou affiche un état vide explicite).

## Pages

| Adresse | Contenu | Endpoints |
| --- | --- | --- |
| `/accueil` | statuts, barre « Partagez… », fil infini, nouvelles publications, colonne latérale | `GET /feed/`, `GET /statuses/`, `GET /me/group-invitations/`, `GET /me/classroom-invitations/`, `GET /hashtags/trending/`, `GET /groups/`, `GET /ads/serve/` |
| `/publications/[id]` | publication complète + discussion (réponses chargées à la demande) | `GET /posts/{id}/`, `GET /posts/{id}/comments/`, `GET /comments/{id}/replies/` |
| `/hashtags/[tag]` | publications d'un hashtag | `GET /hashtags/{tag}/posts/` |
| `/enregistres` | mes publications enregistrées | `GET /me/saved/` |
| `/espace` | ancienne adresse → redirection vers `/accueil` (`next.config.ts`) | — |

Le gabarit (`app/(membre)/layout.tsx` → `components/member/MemberApp.tsx`) vérifie la session au chargement ; sans session (ou si elle expire en cours de route), retour à `/connexion`.

## Navigation

- **Ordinateur (≥ 1100 px)** : barre supérieure (logo, recherche Ctrl + K, « Créer », messages, notifications, compte), navigation latérale complète, colonne « Pour vous » à partir de 1240 px.
- **Tablette (768–1099 px)** : navigation latérale réduite aux icônes ; les invitations passent en tête du fil.
- **Mobile (< 768 px)** : barre supérieure compacte + barre d'onglets en bas : Accueil · Explorer · ＋ · Enregistrés · Moi.

Les applications pas encore livrées (Messages, Communauté, Learn, Showcase, Opportunités, Boutique) sont affichées **« Bientôt »** et ne sont pas cliquables : aucun lien ne mène à une page 404. Les compteurs de messages et de notifications sont réels. Livrer une application = renseigner son `href` dans `components/member/shell/nav.ts`.

## Fonctionnalités

- **Fil** : défilement continu (préchargement 900 px avant la fin), squelettes, état vide, erreur avec « Réessayer », message hors ligne, pastille « N nouvelles publications » (vérification chaque minute), emplacement publicitaire après la 5ᵉ publication (rien n'est affiché sans annonce).
- **Carte de publication** : auteur, date relative (date complète au survol), audience, groupe ; texte avec #hashtags (liens), @mentions, adresses web et blocs ```code``` ; « Voir plus » / « Lire la suite » (le fil ne transporte que 500 caractères) ; médias (1 à 4 images en grille, « +N », visionneuse plein écran au clavier, vidéo en lecture automatique sans le son quand elle est visible, audio, PDF) ; code, lien, projet/dépôt, sondage.
- **Réactions** : clic = J'aime ; survol prolongé ou appui long = les 6 réactions ; flèche haut au clavier ; double appui sur une image = J'aime.
- **Actions** : commenter, partager (sur mon fil avec un mot et une audience, copier le lien, partage natif du téléphone), enregistrer, modifier/supprimer (mes publications), signaler (les autres).
- **Sondage** : vote à choix unique ou multiple, résultats en pourcentage après le vote ou à la clôture.
- **Commentaires** : récents d'abord, réponses sur un niveau (répondre à une réponse cite son auteur), J'aime, suppression, signalement, saisie collée en bas de la carte (Entrée envoie sur ordinateur).
- **Composeur de publication** : audience (7 visibilités, groupe, audience personnalisée avec recherche de membres), mise en valeur des #hashtags et @mentions pendant la saisie, fichiers (10 max, envoi direct au stockage avec progression réelle, description des images), code, lien, sondage (2 à 10 choix, choix multiple, durée), projet ; brouillon conservé sur l'appareil ; Ctrl + Entrée publie.
- **Statuts** : bandeau (non vus d'abord), visionneuse plein écran (barres de progression, toucher gauche/droite, maintenir = pause, glisser vers le bas = fermer, ← → Espace Échap), marquage « vu », réactions ; création texte (fonds de la charte), image, vidéo, audio, lien, avec aperçu en direct.
- **Recherche (Ctrl + K)** : aller à une page, ouvrir un hashtag, créer ; tendances proposées.

## Ce que les maquettes Stitch montraient et qui n'a PAS été repris

Chiffres inventés (« 1 240 publications », « 2.8k membres », « 14 copies »), « Synchronisation en direct », « Mode Studio Split », « Markdown pris en charge », statut « Document » (le serveur refuse les PDF pour un statut), présence en ligne et accusés de lecture (non exposés par l'API), profils cliquables (lot 2).

## Conventions du champ `payload` des publications

Le backend accepte un objet libre ; le frontend écrit et lit ces formes (`features/social/payload.ts`) :

| Type | `payload` |
| --- | --- |
| `code` | `{ language, filename?, code }` |
| `link` | `{ url }` (http/https uniquement) |
| `project` | `{ name, description?, technologies[], url?, repository_url? }` |

## Correctif backend livré avec ce lot

Fichier `apps/social/api.py` + tests `tests/test_api_social_viewer_state.py` (5 tests). **À déployer sur Render**, sinon ces éléments n'apparaissent pas (le frontend fonctionne quand même) :

- fil : `my_reaction`, `saved`, `poll`, `group`, `group_name` sur chaque carte ;
- publication : `poll` (question, options avec votes, mes votes) et `group_name` ;
- statuts : `viewed` et `visibility` ;
- commentaires et réponses : `my_reaction`.

## Mouvement et accessibilité

- 4 courbes et 4 durées (`--bb-ease-*`, `--bb-dur-*` dans `app/globals.css`) ; `prefers-reduced-motion` réduit toutes les animations ; pas de lecture automatique des vidéos en mode économie de données.
- Boîtes de dialogue sur l'élément `<dialog>` natif (piège du focus, Échap, retour du focus), feuilles montantes sur mobile.
- Menus au motif ARIA « menu button », recherche au motif « combobox », notifications annoncées (`role="status"`), cibles tactiles ≥ 40 px, contrastes AA.

## Vérification

Suite de bout en bout Playwright contre le **vrai backend** lancé en local (PostgreSQL, Redis, stockage simulé) : 53 contrôles — inscription → confirmation → `/accueil`, connexion, réactions persistées, sélecteur de réactions, enregistrement, vote, recherche, hashtag, commentaires et réponses, création (texte, code, image avec envoi, sondage, audience personnalisée), modification, suppression, signalement, statuts (lecture, réaction, navigation, création), invitation, déconnexion ; aucune erreur console ; aucun débordement horizontal de 320 à 1920 px.
