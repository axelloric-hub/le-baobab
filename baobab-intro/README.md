# LE BAOBAB — Frontend (landing + cinématique d'ouverture)

**Next.js 16 + React 19 + TypeScript**, styles en CSS Modules, dessin en SVG. Aucune bibliothèque d'animation ou d'icônes, et aucune requête réseau externe (polices auto-hébergées).

- **`/`** — landing page complète (navigation, hero, 9 sections, pied de page), précédée de la cinématique de 7 s à chaque ouverture.
- **`/communaute`**, **`/blog`**, **`/docs`** — les pages Communauté, Blog et Documentation (maquettes Stitch), plus un article modèle (`/blog/idempotence-webhooks`) et un premier guide (`/docs/creer-son-compte`).
- **`/intro`** — la cinématique seule, en plein écran, pour la présenter ou la filmer.

## Prérequis

- Node.js **20.9 ou plus récent** (LTS 22 recommandée) : `node -v`
- npm (fourni avec Node.js)
- Aucun paquet Python (voir `requirements.txt`)

## Lancer (Windows : invite de commandes ou terminal VS Code)

Depuis la racine du dépôt `le-baobab` :

```bash
cd baobab-intro
npm install
npm run dev
```

Puis ouvrir :

| Adresse | Contenu |
|---|---|
| http://localhost:3000 | cinématique, puis landing |
| http://localhost:3000/?intro=0 | landing directement |
| http://localhost:3000/communaute | page Communauté |
| http://localhost:3000/blog | Blog (et l'article modèle) |
| http://localhost:3000/docs | Documentation |
| http://localhost:3000/intro | cinématique seule (R / Espace / clic pour relancer, `?t=4000` pour figer) |

Arrêter : **Ctrl + C**. Version optimisée : `npm run build` puis `npm run start`.

## Vérifier

```bash
npm run typecheck
npm run build
```

## Documentation

- **[docs/LANDING.md](docs/LANDING.md)** — la landing : architecture, contenu à modifier, éléments à raccorder, données de démonstration, lancement sous Windows, erreurs fréquentes.
- **[docs/GUIDE.md](docs/GUIDE.md)** — la cinématique : chronologie, réglages, intégration, capture vidéo.

## Structure

```text
app/
  layout.tsx               polices, script de décision de la cinématique
  page.tsx                 « / »  → LandingPage
  communaute/ blog/ docs/  pages Communauté, Blog (+ article modèle), Docs (+ guide)
  intro/                   « /intro » → cinématique seule (présentation)
  globals.css              jetons de design (--bb-…)
components/
  landing/                 la landing page
    landing-content.ts     textes, liens et chiffres de la navigation et du hero
    sections-content.ts    textes des sections et du pied de page
    SiteHeader.tsx         navigation + menu mobile
    HeroSection.tsx        hero (badge, titre, note, boutons, preuve sociale, logo)
    FeatureCards.tsx       3 cartes du hero
    NetworkBackdrop.tsx    motif réseau d'arrière-plan
    sections/              constat, pour qui, 4 espaces (onglets), repères, IA,
                           ressources, confidentialité, FAQ, bandeau CTA, pied de page
    IntroGate.tsx          cinématique par-dessus la landing
  pages/                   Communauté, Blog, Docs (un fichier de contenu par page)
    shared/                gabarit, bloc de code, bouton copier, bandeau final…
    fonts/                 Inter + Outfit (licence OFL)
  baobab/                  la cinématique (inchangée) + BaobabMark (logo statique)
docs/                      LANDING.md, GUIDE.md
scripts/capture-video.mjs  capture vidéo image par image (optionnelle)
```
