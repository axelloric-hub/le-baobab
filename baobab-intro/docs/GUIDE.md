# Guide de la cinématique LE BAOBAB

> **Depuis la refonte de la landing** : la page de présentation de la cinématique est passée de `/` à **`/intro`** (fichiers `app/intro/`). La page d'accueil `/` affiche désormais la landing, précédée de la cinématique à chaque ouverture. Les composants de la cinématique n'ont pas été modifiés. Détails : `docs/LANDING.md`.

Ce guide s'adresse à quelqu'un qui sait coder mais n'a jamais animé de SVG. Il couvre le fonctionnement, les réglages, l'intégration dans le frontend et la présentation vidéo.

---

## 1. Architecture

```text
components/baobab/
├── BaobabIntro.tsx          ← composant principal, le seul à importer
├── BaobabTree.tsx           ← SVG de l'arbre : ombre, ondes, tronc, branches, feuilles, éclair
├── LightningEffect.tsx      ← phase 1
├── BlueLeaves.tsx           ← phase 4 (+ accolades + frémissement de la phase 6)
├── EnergyWaves.tsx          ← phase 5 (+ atténuation en phase 7)
├── BaobabWordmark.tsx       ← phase 7 : le texte
├── push-curve.ts            ← mouvement de l'arbre poussé par le texte
├── tree-geometry.ts         ← DESSIN uniquement (coordonnées, aucun temps)
├── animation-config.ts      ← RÉGLAGES uniquement (durées, couleurs, tailles)
├── BaobabIntro.module.css   ← styles + keyframes
└── fonts/Outfit-Bold.woff2  ← police locale (+ licence OFL)
```

Trois responsabilités sont séparées :

| Fichier | Contient | On le modifie pour… |
|---|---|---|
| `tree-geometry.ts` | la forme de l'arbre | redessiner l'arbre |
| `animation-config.ts` | le temps, les couleurs, les tailles | régler l'animation |
| les composants `.tsx` | l'assemblage | rarement |

**Choix techniques.** Toutes les animations sont des **animations CSS** avec un délai et une durée explicites, calculés depuis `animation-config.ts`. Elles sont :

- **pilotées par le temps** (le navigateur interpole selon l'horloge, pas selon le nombre d'images par seconde) ;
- **exécutées par le moteur de rendu**, sans re-rendu React à chaque image : léger pour les ordinateurs modestes ;
- **synchronisées sur une seule origine** : le montage de la scène. Un re-rendu React ne les relance pas ; seule `replay()` remonte la scène (changement de `key`).

Aucune dépendance en dehors de Next.js / React. Aucune requête réseau pendant l'animation (police embarquée, aucune image externe).

## 2. Rôle de chaque composant

- **`BaobabIntro`** — pose les variables CSS issues de la configuration, attend la police (800 ms max), démarre la scène, mesure la largeur réelle du texte pour centrer l'arbre, déclenche `onComplete` à l'arrivée du texte, gère le mode « animations réduites » et la relance.
- **`BaobabTree`** — le `<svg>` (repère 1070 × 870, copié du logo). Ordre des couches : ombre au sol → ondes → tronc et branches → pousse et point d'énergie → feuilles → particules → éclair. Le SVG a `overflow: visible` : l'éclair descend depuis le haut de l'écran mais frappe toujours le pied exact du tronc, quelle que soit la taille d'écran.
- **`LightningEffect`** — éclair en trois couches (halo large, halo moyen, cœur blanc), fourches, lueur d'impact, deux ondes de choc ellipsoïdales au sol, étincelles.
- **`BlueLeaves`** — les 14 groupes de « feuilles » (les nœuds de réseau du logo) et les accolades `{ }`.
- **`EnergyWaves`** — 4 foyers (gauche, droite, sommet, grand halo) × 3 anneaux.
- **`BaobabWordmark`** — le texte, en Outfit Bold chargée via `next/font/local`.
- **`push-curve.ts`** — génère les keyframes du recul de l'arbre (voir §7).

## 3. Chronologie (7 000 ms)

| Phase | Temps | Ce qui se passe |
|---|---|---|
| 1. Éclair | 0 → 450 ms | écran nuit ; l'éclair tombe (touche le sol à 135 ms), éclat plein écran, onde de choc, étincelles ; le fond passe de la nuit au fond clair du logo |
| 2. Tronc | 450 → 1 300 ms | pousse bleue à l'impact ; la base s'étale, les deux flancs et l'axe central montent ; un point lumineux suit l'axe ; la facette basse se trace |
| 3. Branches | 1 300 → 2 350 ms | petit Y central, grandes branches latérales (diagonale puis bord supérieur), bras supérieurs en dernier |
| 4. Feuilles | 2 350 → 3 450 ms | 14 groupes, ~42 ms d'écart : la tige s'allonge, puis le nœud éclot ; les accolades se tracent dans la 2ᵉ moitié |
| 5. Ondes | 3 450 → 4 000 ms | salves d'anneaux concentriques + halo sur chaque nœud |
| 6. Rayonnement | 4 000 → 6 000 ms | **attente de 2 s** : la ramure frémit, les ondes respirent, quelques particules flottent |
| 7. Nom | 6 000 → 7 000 ms | le texte entre par la droite, touche l'arbre vers 6,23 s et le pousse ; tout s'immobilise à 7 000 ms ; les ondes s'atténuent |

Après 7 s, l'image est stable ; seules les ondes continuent de respirer très discrètement.

Vérifié dans Chromium via l'API Web Animations : fin des branches 2 350 ms, dernière feuille 3 450 ms, première onde 3 450 ms, départ du texte 6 000 ms, fin de toutes les animations finies 7 000 ms.

## 4. Comment l'arbre est dessiné et animé

L'arbre est une suite de **traits SVG** (`<path>`) relevés sur le logo officiel. Chaque trait est écrit dans le sens de sa croissance (du sol vers le ciel).

La technique du « trait qui s'allonge » :

```html
<path d="M535 835 L535 455" pathLength="1" stroke-dasharray="1 2" />
```

- `pathLength="1"` déclare que le trait mesure 1, quelle que soit sa longueur réelle ;
- `stroke-dasharray: 1 2` = un tiret de longueur 1 (le trait entier) suivi d'un vide de 2 ;
- en animant `stroke-dashoffset` de `1` à `0`, le tiret glisse : on voit d'abord du vide, puis le trait apparaît progressivement depuis son point de départ.

```css
@keyframes drawStroke {
  0%   { stroke-dashoffset: 1.02; opacity: 0; }
  2%   { opacity: 1; }
  100% { stroke-dashoffset: 0;    opacity: 1; }
}
```

Chaque trait a sa fenêtre dans sa phase (`from` / `to` entre 0 et 1, dans `tree-geometry.ts`) : c'est ce qui crée le décalage naturel (la base d'abord, l'axe central jusqu'au bout, la facette à la fin). La courbe `cubic-bezier(0.45, 0, 0.2, 1)` donne l'accélération puis la décélération.

## 5. Les feuilles bleues

Dans le logo, les « feuilles » sont des **nœuds de réseau** reliés par des tiges (le développeur et ses connexions). Chaque groupe (`LEAF_GROUPS`) :

1. pivote légèrement depuis son point d'ancrage (`rotate(±10°) scale(0.82)` → position normale) ;
2. ses tiges s'allongent (même technique que les branches) ;
3. ses nœuds éclosent : `scale(0) rotate(-30°)` → `scale(1.22)` → `scale(1)`, avec fondu.

Le calendrier est calculé dans `BlueLeaves.tsx` : l'écart entre groupes (`groupStaggerMs`) est réduit automatiquement si besoin pour que la dernière feuille ait fini exactement à la fin de la phase 4.

## 6. Les ondes

Chaque anneau est un `<circle>` qui grandit (`scale 0.55 → 1.3`) en apparaissant puis en s'effaçant. Trois anneaux par foyer partent à 150 ms d'intervalle : on voit une salve concentrique. L'animation se répète toutes les `periodMs` (respiration). Les ondes sont dessinées **derrière** l'arbre : elles ne masquent jamais les feuilles. Pendant la phase 7, toute la couche descend à `finalLayerOpacity` pour ne pas concurrencer le nom.

## 7. Comment le texte pousse l'arbre

La composition finale est une simple ligne flex : `[arbre] [espace] [LE BAOBAB]`, centrée à l'écran. Le texte est donc toujours à sa place finale dans la mise en page ; seules des **transformations** le déplacent :

- au départ, l'arbre est décalé vers la droite de `--tree-shift` = (largeur du texte + espace) / 2, ce qui le place seul au centre de l'écran (largeur mesurée en JavaScript) ;
- le texte est décalé de `wordmarkTravelRatio × hauteur de l'arbre` vers la droite et glisse vers 0 ;
- l'arbre reste immobile tant que le texte ne l'a pas atteint, puis recule **au même rythme que le texte**, en gardant exactement l'écart final (mesuré : écart constant ≈ 29 px de 6,25 s à 7 s en 1920 × 1080).

`push-curve.ts` calcule cette relation (minimum « adouci » entre la position du texte et le décalage de l'arbre, pour éviter un à-coup au contact) et l'échantillonne en 49 keyframes CSS. C'est une vraie translation continue : l'arbre ne disparaît jamais.

## 8. Les paramètres modifiables

Tout est dans **`components/baobab/animation-config.ts`** :

| Bloc | Paramètres |
|---|---|
| `phaseDurations` | durée de chaque phase, dont `waitBeforeWordmark` (les 2 s) — la durée totale en découle |
| `colors` | tronc, feuilles, accolades, texte, éclair (cœur / halo), étincelles, ondes |
| `background` | fond nuit, fond final, éclat de l'impact et son intensité |
| `lightning` | moment de l'impact dans la phase 1, nombre d'étincelles |
| `leaves` | écart entre groupes, durée d'une tige, durée d'éclosion, rotation initiale |
| `waves` | anneaux par foyer, opacité max, période, opacité finale, épaisseur |
| `ambience` | nombre de particules, amplitude du frémissement |
| `layout` | taille du logo, espace arbre/texte, taille du texte, distance parcourue par le texte, décalage final de la composition, accolades oui/non |
| `reducedMotion` | durées du mode « animations réduites » |

## 9. Couleurs, tailles et vitesses

**Couleurs** — changer les valeurs de `colors` et `background`. Les valeurs actuelles sont mesurées sur le logo : brun `#8A3A12`, bleu `#3479EE`.

Variante sur fond sombre de bout en bout :

```ts
background: { ..., day: "#071229", dayGlow: "#10284F" },
colors: { ..., trunk: "#C8743F", wordmark: "#F2E7DA" },
```

**Tailles** — `layout.logoHeight` (hauteur de l'arbre). Les unités `cqh`/`cqw` sont relatives au **conteneur** de la cinématique : `min(38cqh, 23cqw)` = 38 % de sa hauteur, sans dépasser 23 % de sa largeur (pour que le logo complet tienne). Le texte suit via `wordmarkSizeRatio`, l'espace via `gapRatio`.

**Vitesses** — la vitesse d'un élément = la durée de sa phase. Tronc plus lent : augmenter `phaseDurations.trunk`. Feuilles plus « en cascade » : augmenter `leaves.groupStaggerMs` (le calendrier se recale tout seul dans la phase).

## 10. Modifier la durée des phases

Changer une valeur de `phaseDurations` décale automatiquement toutes les phases suivantes ; la durée totale (`TOTAL_DURATION_MS`) est recalculée et exposée sur le conteneur (`data-total-ms`). Pour garder exactement 7 s, compenser ailleurs (par exemple +100 ms au tronc, −100 ms aux branches). Ne pas réduire `waitBeforeWordmark` en dessous de 2000 si l'on veut respecter le cahier des charges.

## 11. Remplacer l'arbre par une version plus fidèle

Le dessin actuel reprend le logo officiel trait par trait. Pour l'affiner avec le fichier vectoriel du designer :

1. Ouvrir le SVG officiel dans Figma, Inkscape ou un éditeur texte.
2. Le ramener à un `viewBox` de `0 0 1070 870` (ou changer `TREE_VIEWBOX`).
3. Pour chaque trait **brun**, copier son attribut `d` dans `TRUNK_STROKES` ou `BRANCH_STROKES` avec une fenêtre `from`/`to`. Le trait doit être un contour (`stroke`), pas une forme remplie ; dans Figma : décocher « Outline stroke ». Si le trait pousse dans le mauvais sens, inverser l'ordre de ses points (Inkscape : *Chemin → Inverser*).
4. Pour les nœuds **bleus**, renseigner `LEAF_GROUPS` (point d'ancrage, tiges, centres des nœuds).
5. Mettre à jour `IMPACT_POINT` (pied du tronc) et `WAVE_SOURCES` si la ramure change.

Le logo de référence est dans `public/assets/logo-reference.png`.

## 12. Intégrer dans le frontend Next.js du camarade

**Transfert :**

1. Copier **tout le dossier** `components/baobab/` dans son projet (par exemple `src/components/baobab/`). Il contient le code, les styles et la police : rien d'autre à copier.
2. Aucune dépendance à ajouter : il faut seulement `next` (13 ou plus pour `next/font/local`, testé en 16.4) et `react`. L'API `ref` en propriété utilise **React 19** ; en React 18, convertir la `ref` avec `forwardRef`.
3. Aucune modification de `next.config`, des routes, de l'authentification ou du backend.

Le composant occupe 100 % de la largeur et `100dvh` de hauteur. Pour une autre taille, passer une `className` qui redéfinit `height`.

**Mode A — page dédiée** (`app/intro/page.tsx`) :

```tsx
"use client";
import { useRouter } from "next/navigation";
import { BaobabIntro } from "@/components/baobab/BaobabIntro";

export default function IntroPage() {
  const router = useRouter();
  return <BaobabIntro onComplete={() => router.replace("/login")} />;
}
```

**Mode B — superposée au démarrage de l'application**, puis l'écran suivant :

```tsx
"use client";
import { useState } from "react";
import { BaobabIntro } from "@/components/baobab/BaobabIntro";

export function AppWithIntro({ children }: { children: React.ReactNode }) {
  const [introDone, setIntroDone] = useState(false);
  return (
    <>
      {children /* l'écran d'accueil ou de connexion se charge déjà derrière */}
      {!introDone && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
          <BaobabIntro onComplete={() => setTimeout(() => setIntroDone(true), 600)} />
        </div>
      )}
    </>
  );
}
```

Utiliser `AppWithIntro` dans `app/layout.tsx` autour de `{children}`. Pour ne la montrer qu'une fois par session : lire/écrire `sessionStorage.getItem("baobab-intro-vue")` avant d'afficher la superposition.

**Propriétés :**

| Propriété | Défaut | Rôle |
|---|---|---|
| `onComplete` | — | appelée une seule fois quand le logo final est en place |
| `className` | — | habillage du conteneur |
| `autoPlay` | `true` | si `false`, rien ne démarre avant `ref.current.replay()` |
| `respectReducedMotion` | `true` | version courte en fondu si l'utilisateur a demandé moins d'animations |
| `ref` | — | `{ replay() }` pour relancer |

## 13. Déclencher l'écran suivant

`onComplete` est appelée à la fin de l'animation du texte (événement `animationend`, donc à 7 s), une seule fois par lecture. Un filet de sécurité l'appelle à 8,5 s si l'événement n'arrive pas (onglet en arrière-plan). En mode « animations réduites », elle est appelée après 2 s. L'état est aussi lisible sur le conteneur : `data-state="idle" | "playing" | "reduced" | "complete"`.

Pour enchaîner en douceur, laisser le logo final visible un court instant (exemple du mode B : 600 ms) puis afficher l'écran suivant.

## 14. Installer les dépendances

Node.js 20.9+ est requis (`node -v`). Si besoin, l'installer depuis nodejs.org (version LTS). Puis, dans le dossier du projet :

```bash
npm install
```

`requirements.txt` existe mais ne contient aucun paquet : aucun Python n'est nécessaire.

## 15. Lancer le projet

| Commande | Usage |
|---|---|
| `npm run dev` | développement, rechargement à chaud — cinématique seule sur http://localhost:3000/intro, landing sur http://localhost:3000 |
| `npm run build` puis `npm run start` | version optimisée, la plus fluide pour filmer |
| `npm run typecheck` | vérification TypeScript |

Port occupé : `npm run dev -- -p 3001`.

## 16. Présenter l'animation en filmant l'écran (Windows)

1. Ouvrir le dossier dans l'Explorateur, taper `cmd` dans la barre d'adresse puis Entrée (ou *Terminal → Nouveau terminal* dans VS Code).
2. `npm install` (la première fois seulement).
3. Pour la meilleure fluidité : `npm run build` puis `npm run start` (sinon `npm run dev`).
4. Ouvrir **http://localhost:3000/intro** dans Chrome ou Edge (cinématique seule ; la page d'accueil `/` la joue aussi avant la landing, voir `docs/LANDING.md`).
5. Appuyer sur **F11** pour le plein écran. Déplacer la souris hors de l'écran.
6. Appuyer sur **R** (ou Espace, Entrée, ou cliquer) pour relancer la cinématique.

Aucun bouton n'est affiché ; l'indicateur de développement de Next.js est désactivé (`devIndicators: false`).

## 17. Enregistrer une vidéo propre

**Xbox Game Bar (intégrée à Windows 10/11)** — dans le navigateur en plein écran : **Win + Alt + R** démarre l'enregistrement, appuyer sur **R** pour relancer la cinématique, attendre la fin, **Win + Alt + R** pour arrêter. La vidéo est dans *Vidéos → Captures*.

**OBS Studio (gratuit, obsproject.com)** — Sources : *Capture d'écran* (ou *Capture de fenêtre* du navigateur). Paramètres → Vidéo : 1920×1080, 60 i/s. Paramètres → Sortie : format MP4. *Démarrer l'enregistrement*, appuyer sur **R**, attendre 8 s, arrêter.

Conseils : fermer les onglets lourds, utiliser `npm run start` plutôt que `dev`, et lancer une première lecture « à blanc » avant de filmer.

**Option automatique, image par image (Playwright + ffmpeg)** — rendu parfait même sur une machine lente :

```bash
npm install --no-save playwright
npx playwright install chromium
npm run start            # dans un premier terminal
node scripts/capture-video.mjs            # dans un second terminal
```

Résultat : `captures/baobab-intro-1920x1080.mp4` (7 s + 1 s de logo final, 60 i/s). Options : `--fps 30 --width 1280 --height 720 --hold 2000`. Sans ffmpeg installé, les images PNG restent dans `captures/frames/`.

Ce script fige chaque instant avec `window.__baobabSeek(ms)` : la même fonction sert à inspecter une phase précise via l'URL `/intro?t=3450`.

## 18. Problèmes courants

| Problème | Solution |
|---|---|
| `'next' n'est pas reconnu…` | `npm install` n'a pas été lancé, ou pas dans le bon dossier |
| `Port 3000 is in use` | `npm run dev -- -p 3001`, puis ouvrir http://localhost:3001 |
| Version de Node trop ancienne | installer Node.js LTS (≥ 20.9) |
| Saccades pendant l'enregistrement | `npm run build` + `npm run start`, fermer les autres applications, ou utiliser la capture automatique |
| L'animation ne bouge pas, logo affiché d'un coup en fondu | Windows a « réduire les animations » actif (*Paramètres → Accessibilité → Effets visuels → Effets d'animation*) ; ou passer `respectReducedMotion={false}` |
| L'animation reste figée | l'URL contient `?t=…` : l'enlever |
| Rien ne se passe dans un autre projet | le conteneur doit avoir une hauteur ; le composant est un composant client (`"use client"` déjà présent) |
| Texte pas centré après changement de police | mettre à jour `layout.wordmarkWidthEm` (la mesure JS corrige la position, la valeur sert au calcul de la poussée) |
| Erreur sur `ref` en React 18 | envelopper `BaobabIntro` avec `forwardRef` |
| Le logo est coupé sur un très petit écran | baisser `layout.logoHeight` (ex. `min(34cqh, 20cqw)`) |
