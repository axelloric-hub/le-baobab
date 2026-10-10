# Landing page LE BAOBAB

Ce document explique la nouvelle page d'accueil, ce qui reste à raccorder et comment la lancer sous Windows.

## 1. Ce qui a été fait

- **Phase 1** : la navigation et la section principale (hero), conformément à la référence Gemini.
- **Phase 2** : toutes les sections du frontend généré (`code.html`) sous le hero, dans le même système de design, ainsi que le pied de page complet (voir §5).

| Zone | Fichier |
|---|---|
| Assemblage de la page | `components/landing/LandingPage.tsx` |
| Barre de navigation + menu mobile | `components/landing/SiteHeader.tsx` (+ `.module.css`) |
| Hero : badge, titre, texte, note, boutons, preuve sociale, logo central | `components/landing/HeroSection.tsx` (+ `Hero.module.css`) |
| Trois cartes de fonctionnalités | `components/landing/FeatureCards.tsx` |
| Motif réseau d'arrière-plan | `components/landing/NetworkBackdrop.tsx` |
| Sections sous le hero + pied de page | `components/landing/sections/` (voir §5) |
| Cinématique avant la landing | `components/landing/IntroGate.tsx` + `intro-gate-script.ts` |
| **Tous les textes, liens et chiffres** | `components/landing/landing-content.ts` (navigation, hero) et `components/landing/sections-content.ts` (sections) |
| Couleurs, ombres, rayons | `app/globals.css` (variables `--bb-…`) |
| Polices locales (Inter, Outfit) | `components/landing/fonts.ts` + `fonts/` |
| Logo statique | `components/baobab/BaobabMark.tsx` |

### Choix de design

- **Palette** : ivoire `#FBF8F3`, brun du logo `#8A3A12`, brun profond pour le titre et les boutons, bleu du logo `#3479EE` pour les accents. Tout passe par les variables de `app/globals.css`.
- **Typographie** :
  - Inter pour l'interface et le titre (graisse 760, interlettrage resserré), proche de la référence ;
  - Outfit pour « LE BAOBAB » et la signature, comme dans le logo et la cinématique ;
  - les deux sont auto-hébergées : aucun appel à Google Fonts.
- **Logo** : `BaobabMark` est dessiné avec **la même géométrie** que la cinématique (`tree-geometry.ts`). Le logo de la navigation, celui du hero et la fin de la cinématique sont donc strictement identiques, sans image ni dessin approximatif.
- **Composition** : elle s'adapte à la taille de l'écran.

  | Largeur d'écran | Disposition |
  |---|---|
  | 1200 px et plus | trois zones : message, symbole, cartes |
  | 900 à 1199 px | message et symbole côte à côte, cartes en ligne en dessous |
  | Moins de 900 px | une seule colonne dans l'ordre de lecture |

  - Le titre est dimensionné par rapport à sa colonne (`cqi`). Chaque groupe « Mot. » est insécable : aucun mot isolé en fin de ligne.
  - Sur les ordinateurs peu hauts (1366×768, 1280×800), un réglage dédié garde tout visible sans défilement.
- **Animations** :
  - une seule cascade d'apparition (≈ 0,9 s) ;
  - survols discrets ;
  - aucune animation en boucle ;
  - les animations de la page (pas la cinématique) sont désactivées si l'utilisateur a demandé moins d'animations.
- **Serveur d'abord** : seuls l'en-tête (menu mobile), les onglets, les boutons « Voir l'intro » et la cinématique sont des composants clients. Le reste est rendu côté serveur, sans JavaScript.

## 2. La cinématique est conservée

- Les composants de `components/baobab/` (éclair, tronc, branches, feuilles, ondes, texte, chronologie de 7 s) **n'ont pas été modifiés**. Seul `BaobabMark.tsx` a été ajouté à côté.
- **Sur `/`** : elle est jouée **à chaque ouverture de la page**, en version complète, puis s'efface en fondu et la landing apparaît. C'est un choix produit.
  - Un petit script dans `<head>` (`intro-gate-script.ts`) décide avant le premier affichage. Il n'y a donc pas de clignotement de la landing.
  - Pendant la lecture : « Passer l'intro » ou **Échap** pour la sauter. La page derrière est inerte.
  - La version complète est jouée même si Windows ou le navigateur demandent moins d'animations. Le visiteur peut toujours la passer.
- **Sur `/intro`** : la page de présentation d'hier, inchangée, pour filmer l'écran.
  - R, Espace, Entrée ou un clic relancent l'animation.
  - `?t=4000` fige l'image à 4 s.
- **Paramètres d'URL de `/`** :
  - `?intro=0` la désactive.

## 3. Boutons et liens : ce qui fonctionne, ce qui attend

Aucune page, route ou parcours n'a été inventé. Les pages **Communauté**, **Blog** et **Docs** existent désormais (voir §7) ; il n'existe toujours ni page d'inscription, ni page de connexion.

| Élément | Comportement actuel | À raccorder |
|---|---|---|
| **Accueil** | lien réel vers `/` | — |
| **Plateforme**, **Ressources** | sections de l'accueil (`/#plateforme`, `/#integrations`) : défilement direct depuis l'accueil, retour à l'accueil depuis les autres pages | — |
| **Communauté**, **Docs**, **Blog** | **liens réels** vers `/communaute`, `/docs`, `/blog` (soulignés quand la page est ouverte) | — |
| **Rejoindre** | **visuel uniquement** : aucune route, aucune action | phase suivante (inscription) |
| **Créer mon profil** (hero et bandeau) | visuel uniquement : aucun parcours d'inscription n'existe | le relier au futur parcours d'inscription |
| **Voir l'intro** / **Revoir l'intro** | **rejouent la cinématique** | — |
| Cartes de fonctionnalités | informatives, pas de lien | pages dédiées |
| « Rejoindre », « Enseigner », « Proposer », « Recruter », « Publier » (cartes Pour qui) | libellés sans lien, étiquette « Bientôt » | pages dédiées |
| « Rejoindre un groupe », « Découvrir les cours », « Créer mon portfolio », « Voir les offres », « Explorer les cours » | visuels uniquement | parcours correspondants |
| Pied de page : Communauté, Documentation, Créer son compte, Blog | **liens réels** | — |
| Autres liens du pied de page + Confidentialité, Conditions, Mentions légales | texte simple, non cliquable | ajouter `href` dans `FOOTER` (`sections-content.ts`) |
| Icône GitHub du pied de page | **lien réel** vers le dépôt public `axelloric-hub/le-baobab` (nouvel onglet) | — |

La page ne contient aucun lien `href="#"` (vérifié automatiquement).

Pour rendre un lien actif, il suffit de compléter son `href` dans `landing-content.ts` (navigation) ou `sections-content.ts` (pied de page) :

```ts
{ label: "Learn", href: "/learn" },
```

## 4. Ligne éditoriale (réécriture du contenu)

Tous les textes ont été réécrits à partir de `GUIDE_BACKEND.txt`, de `RESTE_A_FAIRE.md` et de l'image de vision du projet. Ils sont dans deux fichiers :
- `components/landing/landing-content.ts` : navigation et hero ;
- `components/landing/sections-content.ts` : sections et pied de page.

**Règles appliquées :**
- **Ne décrire que ce qui est construit côté serveur** :
  - profils, groupes, canaux et messagerie en temps réel ;
  - publications, sondages, statuts de 24 h ;
  - classes, cours, modules et chapitres, quiz et devoirs, certificats vérifiables par code ;
  - portfolio ;
  - entreprises, offres, candidatures, entretiens, offres d'embauche ;
  - freelance : propositions, contrats, jalons ;
  - boutiques avec versions et licences ;
  - visibilité, isolation des comptes, modération, droit à l'effacement.
- **Aucun chiffre d'usage.** Les trois repères affichés (« 1 profil », « 6 formats » de questions, « 24 h » pour un statut) décrivent le produit et se vérifient dans le code. Il n'y a plus ni note, ni avis, ni nombre de membres, ni avatars.
- **Ce qui n'est pas prêt est omis, ou annoncé explicitement comme à venir** :
  - le paiement en ligne (la FAQ le dit) ;
  - l'IA BAOBAB (badges « En préparation » et « Bientôt ») ;
  - la synchronisation GitHub, GitLab et LinkedIn (la FAQ le dit) ;
  - les e-mails de notification et le push (non mentionnés) ;
  - la vidéo en streaming (« vidéo » désigne seulement un support de cours) ;
  - la publicité (non mentionnée).
- **Les aperçus des onglets** (discussion, cours, `portfolio.json`, mission) sont marqués « Aperçu illustratif ». Les personnes, projets et codes qu'ils montrent sont fictifs.
- **« 100% Open Source »** reste masqué tant que le dépôt n'a pas de licence (`IS_OPEN_SOURCE`).
- **La version affichée** est celle de `package.json` (v1.0.0).

## 5. Sections sous le hero (phase 2)

Leur structure vient du `code.html` de l'équipe ; leurs textes ont été entièrement réécrits (voir §4). Elles n'utilisent ni Tailwind, ni Material Symbols, ni image externe.

| Section | Fichier | Particularités |
|---|---|---|
| Le constat | `sections/ProblemSection.tsx` | visuel « 5 lieux éparpillés → 1 arbre » |
| Pour qui : développeurs, formateurs, freelances, entreprises, créateurs | `sections/ChannelsSection.tsx` | grille 5 / 3 + 2 / 2 / 1 colonnes |
| Quatre espaces (Communauté, Learn, Showcase, Opportunités) | `sections/WorkspaceSection.tsx` + `WorkspaceTabs.tsx` | **onglets accessibles** (flèches, Début / Fin) ; les 4 panneaux sont dans le HTML ; aperçus marqués « illustratifs » |
| Repères produit (1 profil, 6 formats, 24 h) | `sections/StatsSection.tsx` | faits vérifiables, pas de statistiques d'usage |
| IA BAOBAB | `sections/CopilotSection.tsx` | présentée comme en préparation (la passerelle IA n'existe pas) |
| Ressources : supports de cours | `sections/IntegrationsSection.tsx` | cible du lien « Ressources » de la navigation |
| Confidentialité | `sections/SecuritySection.tsx` | uniquement des mesures présentes dans le code |
| FAQ | `sections/FaqSection.tsx` | accordéon natif `<details>` : une seule réponse ouverte, fonctionne sans JavaScript |
| Explorer : Communauté, Blog, Docs | `sections/ExploreSection.tsx` | trois cartes entièrement cliquables vers les nouvelles pages |
| Bandeau d'appel à l'action | `sections/CtaBanner.tsx` | « Revoir l'intro » rejoue la cinématique |
| Pied de page complet | `sections/SiteFooter.tsx` | 5 colonnes, mentions légales, version, lien GitHub |

**Le `code.html` n'a pas été copié tel quel**, pour plusieurs raisons :
- les deux arbres animés en boucle (fond de page et bandeau CTA) sont remplacés par des décors fixes ;
- le logo hébergé chez Google est remplacé par le vrai tracé ;
- les sections vides de la maquette (« Social proof logo bar », « Numbers speak », « Recognition ») n'ont pas été créées.

**Animations** : les sections apparaissent au défilement grâce aux *scroll-driven animations* CSS, sans JavaScript. Les navigateurs qui ne les gèrent pas affichent simplement le contenu. Ces animations sont désactivées si l'utilisateur a demandé moins d'animations.

### Correspondance avec la vision du projet

| Vision | Sur la page |
|---|---|
| Communauté · Learn · Showcase | les trois cartes du hero et les trois premiers onglets |
| Opportunités (emplois, freelance, produits, services) | le quatrième onglet et les cartes « Freelances », « Entreprises » et « Créateurs » |
| IA BAOBAB (réponses contextuelles, modération, recommandations) | la section IA, présentée comme en préparation |
| « Connect · Learn · Build · Grow » | la devise sous les boutons du hero |
| « Conçu pour la communauté des développeurs africains » | le bandeau du pied de page |

L'administration (supervision, modération, statistiques) n'est pas présentée : elle ne concerne pas les visiteurs.

## 6. Lancer le projet sous Windows

**Dossier** : dans votre clone du dépôt, branche `frontend-intro`, le projet est dans

```
le-baobab\baobab-intro\baobab-intro
```

(Le dossier racine `le-baobab` contient le backend Django : ce n'est pas là qu'il faut lancer `npm`.)

1. **Ouvrir un terminal dans ce dossier**, au choix :
   - dans l'Explorateur, aller dans `baobab-intro\baobab-intro`, taper `cmd` dans la barre d'adresse, puis Entrée ;
   - ou dans VS Code : *Fichier → Ouvrir le dossier…*, puis *Terminal → Nouveau terminal* ;
   - ou depuis une invite de commandes déjà ouverte à la racine du dépôt :
     ```
     cd baobab-intro\baobab-intro
     ```
2. **Vérifier Node.js** (version 20.9 ou plus) :
   ```
   node -v
   ```
3. **Installer les dépendances**, la première fois et après chaque `git pull` qui modifie `package.json` :
   ```
   npm install
   ```
4. **Lancer le frontend** :
   ```
   npm run dev
   ```
5. **Vérifier que le serveur a démarré** : le terminal affiche `▲ Next.js 16…` puis `✓ Ready in …` avec `Local: http://localhost:3000`.
6. **Ouvrir dans Chrome ou Edge** :

   | Adresse | Contenu |
   |---|---|
   | http://localhost:3000 | cinématique (1re fois), puis landing |
   | http://localhost:3000/?intro=1 | force la cinématique avant la landing |
   | http://localhost:3000/?intro=0 | landing directement |
   | http://localhost:3000/intro | cinématique seule, pour filmer |

7. **Après une modification** : avec `npm run dev`, la page se met à jour toute seule à l'enregistrement du fichier. Si ce n'est pas le cas, actualisez avec F5.
8. **Arrêter le serveur** : dans le terminal, **Ctrl + C**, puis `O` (ou `Y`) et Entrée si Windows demande confirmation.
9. **Relancer** : `npm run dev`.

**Version optimisée**, la plus fluide pour filmer :

```
npm run build
npm run start
```

**Vérifications de code** :

```
npm run typecheck
npm run build
```

### Erreurs fréquentes

| Message | Solution |
|---|---|
| `'next' n'est pas reconnu…` ou `Cannot find module` | `npm install` n'a pas été lancé, ou pas dans `baobab-intro\baobab-intro` |
| `npm ERR! enoent … package.json` | mauvais dossier : il faut être dans `baobab-intro\baobab-intro` |
| `Port 3000 is in use` | un autre serveur tourne déjà : le fermer (Ctrl + C), ou lancer `npm run dev -- -p 3001` et ouvrir http://localhost:3001 |
| `You are using Node.js 18…` | installer Node.js LTS (≥ 20.9) depuis nodejs.org, puis rouvrir le terminal |
| Je veux voir la page sans la cinématique (pour travailler dessus) | ouvrir http://localhost:3000/?intro=0 |
| Les sections apparaissent sans effet au défilement | Windows a « Effets d'animation » désactivé (Paramètres → Accessibilité → Effets visuels). La cinématique, elle, est toujours jouée en entier |
| Page blanche après une mise à jour | arrêter le serveur, supprimer le dossier `.next`, relancer `npm run dev` |

## 7. Pages Communauté, Blog et Docs

Elles viennent des trois maquettes exportées de Google Stitch. Comme pour l'accueil, **la structure et l'esprit visuel sont repris, pas le code** (ni Tailwind, ni Material Symbols, ni polices Google) : mêmes jetons `--bb-…`, mêmes polices auto-hébergées, même en-tête et même pied de page. La cinématique reste réservée à l'accueil.

| Adresse | Fichiers | Contenu |
|---|---|---|
| `/communaute` | `components/pages/community/` | héros + publication d'exemple, 4 outils, entraide (fil de discussion), confidentialité (**choix de visibilité cliquable** : les 7 visibilités réelles du backend), bandeau final |
| `/blog` | `components/pages/blog/` | héros, **filtres par thème qui filtrent réellement la grille**, article à la une, 6 dossiers annoncés, encart « En coulisses », bandeau final |
| `/blog/idempotence-webhooks` | `blog/ArticlePage.tsx`, `blog/article-idempotence.ts` | article modèle : barre de progression de lecture, sommaire collant qui suit la lecture, bloc de code coloré avec bouton **Copier**, **Copier le lien**, partage X / LinkedIn / e-mail réels |
| `/docs` | `components/pages/docs/` | documentation en 3 colonnes : index, contenu, « Sur cette page » ; **recherche réelle** dans les guides (Ctrl + K) ; cycle du développeur ; 7 piliers |
| `/docs/creer-son-compte` | `docs/DocsAccount.tsx` | guide pas à pas de l'inscription, **fidèle au code** : code à 6 chiffres valable 10 min, 5 essais, 60 s entre deux envois, nom d'utilisateur de 3 à 30 caractères, mot de passe de 10 caractères minimum |

Tous les textes sont dans un fichier par page (`community-content.ts`, `blog-content.ts`, `article-idempotence.ts`, `docs-content.ts`).

**Ce qui a été corrigé par rapport aux maquettes** (règle éditoriale du §4) :
- aucun chiffre inventé : compteurs de réactions (142, 28 réponses…), « 38 en ligne », « 99,98 % », « des milliers de développeurs » supprimés ;
- aucune personne présentée comme réelle : les auteurs inventés des articles recommandés sont retirés ; les noms restants figurent uniquement dans des aperçus marqués « Aperçu illustratif » ;
- pas de dates ni de numéros de version inventés (la version affichée est celle de `package.json`) ;
- « Synchronisation GitHub », « notifications des groupes par e-mail », « tracking », « chiffrement & clés » retirés : ces fonctions n'existent pas (voir `RESTE_A_FAIRE.md`) ;
- l'inscription décrite par Stitch (lien valable 15 min, mot de passe de 12 caractères…) a été remplacée par le parcours réel du backend ;
- l'exemple de code de l'article a été corrigé (application FastAPI déclarée, client Redis asynchrone, clé conservée 24 h, verrou libéré en cas d'échec) et la « signature asymétrique » HMAC (qui est symétrique) rectifiée.

**Boutons sans destination** (inscription, notifications, discussion, réactions, vote d'utilité…) : ils sont affichés comme dans la maquette mais signalés « Bientôt disponible » (`aria-disabled`), exactement comme « Rejoindre ». Les guides de documentation pas encore écrits sont listés avec l'étiquette « Bientôt ».

**Ajouter un guide** : créer `app/docs/<slug>/page.tsx`, puis renseigner `href: "/docs/<slug>"` dans `docs-content.ts` ; il devient cliquable partout (menu, cartes, recherche).

**Publier un article** : ajouter son contenu (sur le modèle de `article-idempotence.ts`), créer `app/blog/<slug>/page.tsx`, puis renseigner `slug` dans `BLOG_POSTS`.

