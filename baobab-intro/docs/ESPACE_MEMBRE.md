# Espace membre

- **Lot 1** : Accueil, Statuts, Publication.
- **Lot 2** : Messages, Profil développeur, Notifications et paramètres (voir la section « Lot 2 » plus bas).

Pages réservées aux membres connectés, intégrées à partir des maquettes Stitch et branchées sur l'API réelle. **Aucune donnée de démonstration** : tout ce qui s'affiche vient du serveur ; un bloc sans données ne s'affiche pas (ou affiche un état vide explicite).

## Pages

| Adresse | Contenu | Endpoints |
| --- | --- | --- |
| `/accueil` | statuts, barre « Partagez… », fil infini, nouvelles publications, colonne latérale | `GET /feed/`, `GET /statuses/`, `GET /me/group-invitations/`, `GET /me/classroom-invitations/`, `GET /hashtags/trending/`, `GET /groups/`, `GET /ads/serve/` |
| `/publications/[id]` | publication complète + discussion (réponses chargées à la demande) | `GET /posts/{id}/`, `GET /posts/{id}/comments/`, `GET /comments/{id}/replies/` |
| `/hashtags/[tag]` | publications d'un hashtag | `GET /hashtags/{tag}/posts/` |
| `/enregistres` | mes publications enregistrées | `GET /me/saved/` |
| `/messages`, `/messages/[id]` | messagerie (lot 2) | voir « Lot 2 » |
| `/u/[pseudo]` | profil développeur (lot 2) | voir « Lot 2 » |
| `/notifications` | notifications et paramètres (lot 2) | voir « Lot 2 » |
| `/espace` | ancienne adresse → redirection vers `/accueil` (`next.config.ts`) | — |

Le gabarit (`app/(membre)/layout.tsx` → `components/member/MemberApp.tsx`) vérifie la session au chargement ; sans session (ou si elle expire en cours de route), retour à `/connexion`.

## Navigation

- **Ordinateur (≥ 1100 px)** : barre supérieure (logo, recherche Ctrl + K, « Créer », messages, notifications, compte), navigation latérale complète, colonne « Pour vous » à partir de 1240 px.
- **Tablette (768–1099 px)** : navigation latérale réduite aux icônes ; les invitations passent en tête du fil.
- **Mobile (< 768 px)** : barre supérieure compacte + barre d'onglets en bas : Accueil · Explorer · ＋ · Messages (avec le nombre de non-lus) · Moi. Une poignée au-dessus de la barre ouvre le panneau « Toutes les fonctionnalités » (Enregistrés, groupes, cours, tendances, notifications, compte).

Les applications pas encore livrées (Communauté, Learn, Showcase, Opportunités, Boutique) sont affichées **« Bientôt »** et ne sont pas cliquables : aucun lien ne mène à une page 404. Les compteurs de messages et de notifications sont réels. Livrer une application = renseigner son `href` dans `components/member/shell/nav.ts`.

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

Chiffres inventés (« 1 240 publications », « 2.8k membres », « 14 copies »), « Synchronisation en direct », « Mode Studio Split », « Markdown pris en charge », statut « Document » (le serveur refuse les PDF pour un statut), présence en ligne et accusés de lecture (ajoutés au lot 2, dans le respect des réglages de confidentialité).

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

## Lot 2 — Messages, Profil développeur, Notifications et paramètres

### Messages (`/messages`, `/messages/[id]`)

- **Ordinateur** : liste des conversations à gauche, conversation ouverte à droite ; **mobile** : liste, puis conversation en plein écran (la barre de saisie reste au-dessus du clavier, iPhone compris).
- **Liste** : dernier message (« Vous : … », pièce jointe, code), heure, nombre de non-lus, présence en ligne, filtres « Non lues » et « Groupes », recherche dans la liste ; nouvelle conversation directe ou de groupe (recherche de membres).
- **Conversation** : temps réel (`/ws/conversations/{id}/`), « … est en train d'écrire », envoi optimiste avec `client_msg_id` (un nouvel essai ne crée pas de doublon), états « envoi », « envoyé », « lu » ; historique chargé en remontant ; pastille « Nouveaux messages » ; brouillon conservé par conversation.
- **Messages** : réponse citée (clic = retour au message cité), réactions (les miennes mises en évidence), modification, suppression pour moi ou pour tous, copie, message de code coloré, pièces jointes (jusqu'à 10 fichiers, envoi direct au stockage avec progression). Mobile : glisser vers la droite = répondre, appui long = actions.
- **Confidentialité** : la présence n'est affichée que si l'autre l'autorise ; « Lu » n'est affiché que si les **deux** membres ont activé les accusés de lecture (réciprocité).

### Profil développeur (`/u/[pseudo]`)

- **En-tête** : couverture, photo, nom, titre, métier, ville et pays, disponibilité, date d'inscription, liens (GitHub, GitLab, LinkedIn, site…), compteurs réels (publications, abonnés, abonnements, amis).
- **Relation** (profil d'un autre membre) : ajouter en ami, annuler la demande, accepter ou refuser une demande reçue, retirer des amis, s'abonner, « Vous suit », ami proche, Message, mettre en sourdine, bloquer.
- **Onglets** (adresse `?onglet=`) : Aperçu, Publications, Projets, Parcours, Certificats.
- **Mon profil** : modification de l'identité, des photos, du titre, de la bio, du métier, du pays, de la disponibilité, des compétences (avec niveau) et des liens ; ajout, modification et suppression de projets, expériences, formations et certificats ; carte « Profil complété à N % » avec les éléments manquants.

### Notifications et paramètres (`/notifications`)

- **Cloche (ordinateur)** : panneau « Toutes / Non lues », « Tout marquer comme lu », accepter ou refuser une demande d'ami sans quitter la page. **Mobile** : la cloche mène à la page.
- **Page** : notifications groupées (Aujourd'hui, Hier, Cette semaine, Plus tôt), défilement continu, nouvelle notification annoncée en direct (`/ws/notifications/`, une seule connexion pour toute l'application).
- **Paramètres** : tableau par type et par canal (dans l'application, e-mail), enregistré immédiatement ; les notifications de sécurité ne peuvent pas être désactivées. Les types que le serveur n'émet pas encore ne sont pas proposés.

### Correctifs backend livrés avec le lot 2

Fichiers `apps/messaging/api.py`, `apps/profiles/api.py`, `apps/notifications/api.py`, `apps/portfolio/selectors.py` + tests `tests/test_api_lot2_member_space.py` (6 tests). **À déployer sur Render**, sinon ces éléments n'apparaissent pas (le frontend fonctionne quand même) :

- boîte de réception : `last_message` (aperçu), `with.online` (si l'autre l'autorise), `others_read_seq` (si les deux l'autorisent) ;
- messages : `my_reactions` ;
- profil : `joined_at` et `relation` complète (`follows_me`, `friend_request` avec son sens, `is_close_friend`) ;
- préférences de notification : `default_channels` de chaque type ;
- portfolio : un membre qui n'a encore rien ajouté obtient un portfolio vide au lieu d'une erreur 404.

### Limites connues

- Les données de référence (compétences, métiers, pays) sont enregistrées **sans accents** dans la base ; elles s'affichent telles quelles. À corriger côté données.
- Sur Render (offre gratuite, une seule instance), la couche temps réel est en mémoire : suffisant pour une instance, à passer sur Redis si le service est multiplié.

## Mouvement et accessibilité

- 4 courbes et 4 durées (`--bb-ease-*`, `--bb-dur-*` dans `app/globals.css`) ; `prefers-reduced-motion` réduit toutes les animations ; pas de lecture automatique des vidéos en mode économie de données.
- Boîtes de dialogue sur l'élément `<dialog>` natif (piège du focus, Échap, retour du focus), feuilles montantes sur mobile.
- Menus au motif ARIA « menu button », recherche au motif « combobox », onglets au motif « tabs », conversation en `role="log"`, interrupteurs en `role="switch"`, notifications annoncées (`role="status"`), cibles tactiles ≥ 40 px, contrastes AA.

## Vérification

Suite de bout en bout Playwright contre le **vrai backend** lancé en local (PostgreSQL, Redis, stockage simulé) : 53 contrôles — inscription → confirmation → `/accueil`, connexion, réactions persistées, sélecteur de réactions, enregistrement, vote, recherche, hashtag, commentaires et réponses, création (texte, code, image avec envoi, sondage, audience personnalisée), modification, suppression, signalement, statuts (lecture, réaction, navigation, création), invitation, déconnexion ; aucune erreur console ; aucun débordement horizontal de 320 à 1920 px.

Lot 2 : 72 contrôles supplémentaires — cloche et panneau, demande d'ami acceptée depuis une notification, tout marquer comme lu, préférence enregistrée, type critique verrouillé ; envoi, accusé de lecture et réception en temps réel, réponse, réaction, modification, suppression pour tous, message de code, pièce jointe, nouvelle conversation directe et de groupe ; abonnement, onglets du profil, demande d'ami envoyée puis annulée, bouton Message, modification de la bio, du métier et des compétences, ajout et suppression d'une expérience ; recherche de personnes ; conversation mobile en plein écran ; aucun débordement de 320 à 1920 px ; aucune erreur console. Les suites précédentes (lot 1 : 53, formulaires mobiles : 32, panneau mobile : 50, site public) et les 454 tests backend passent toujours.
