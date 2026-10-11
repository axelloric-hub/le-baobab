# LE BAOBAB — Cinématique d'ouverture

Animation d'ouverture de 7 secondes, codée en **Next.js 16 + React 19 + TypeScript**, dessinée en **SVG** et animée en **CSS** (aucune vidéo, aucune image figée, aucune bibliothèque d'animation).

L'éclair frappe le sol → le tronc pousse → les branches se déploient → les feuilles bleues (les nœuds du logo) éclosent → les ondes rayonnent → 2 s d'attente → « LE BAOBAB » arrive de la droite et pousse l'arbre vers la gauche.

## Prérequis

- **Node.js 20.9 ou plus récent** (LTS 22 recommandée) — vérifier avec `node -v`
- npm (fourni avec Node.js)
- Aucun paquet Python (voir `requirements.txt`)

## Lancer immédiatement

Dans un terminal ouvert dans ce dossier (Windows : invite de commandes ou terminal de VS Code) :

```bash
npm install
npm run dev
```

Ouvrir **http://localhost:3000** dans Chrome ou Edge, puis **F11** pour le plein écran.

| Action | Effet |
|---|---|
| `R`, `Espace`, `Entrée` ou un clic | relance la cinématique |
| `http://localhost:3000/?t=4000` | affiche l'image figée à 4,0 s |

Version optimisée (la plus fluide pour filmer) :

```bash
npm run build
npm run start
```

## Vérifier le code

```bash
npm run typecheck   # TypeScript
npm run build       # compilation de production
```

## Intégrer dans le frontend

Copier le dossier `components/baobab/` dans le projet Next.js, puis :

```tsx
import { BaobabIntro } from "@/components/baobab/BaobabIntro";

<BaobabIntro onComplete={() => router.replace("/login")} />
```

Tout le détail (architecture, réglages, intégration, capture vidéo, dépannage) est dans **[docs/GUIDE.md](docs/GUIDE.md)**.

## Structure

```text
app/                       page de démonstration (plein écran, sans interface)
components/baobab/         LE composant à copier dans le frontend
  BaobabIntro.tsx          composant principal (chronologie, relance, fin)
  BaobabTree.tsx           tronc et branches
  LightningEffect.tsx      éclair, impact, onde de choc, étincelles
  BlueLeaves.tsx           feuilles bleues (nœuds), accolades { }
  EnergyWaves.tsx          ondes bleues
  BaobabWordmark.tsx       texte « LE BAOBAB » (police locale)
  push-curve.ts            calcul du mouvement « poussé » de l'arbre
  tree-geometry.ts         dessin vectoriel de l'arbre (coordonnées)
  animation-config.ts      TOUS les réglages (durées, couleurs, tailles)
  BaobabIntro.module.css   styles et keyframes
  fonts/                   Outfit Bold (licence OFL)
public/assets/             logo de référence
scripts/capture-video.mjs  capture vidéo image par image (optionnelle)
docs/GUIDE.md              documentation complète
```
