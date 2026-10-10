/**
 * Dessin vectoriel de l'arbre du logo LE BAOBAB.
 *
 * Les coordonnées ont été relevées sur le logo officiel (public/assets/logo-reference.png),
 * dans un repère de 1070 × 870 unités. Ce fichier ne contient QUE du dessin : aucun temps.
 *
 * Chaque tracé est écrit dans le sens de la croissance (du sol vers le ciel,
 * du tronc vers l'extrémité des branches), car l'animation révèle le trait
 * depuis son point de départ.
 */

export const TREE_VIEWBOX = { width: 1070, height: 870 } as const;

/** Point d'impact de l'éclair = pied du tronc. */
export const IMPACT_POINT = { x: 535, y: 835 } as const;

export const TRUNK_STROKE_WIDTH = 21;
export const STEM_STROKE_WIDTH = 13;
export const NODE_RADIUS = 20;

/** Un trait du tronc ou d'une branche, et sa fenêtre de croissance dans sa phase (0 → 1). */
export interface GrowingStroke {
  id: string;
  d: string;
  from: number;
  to: number;
}

/** Phase 2 — tronc : base, bords, axe central et facette basse. */
export const TRUNK_STROKES: GrowingStroke[] = [
  { id: "base-left", d: "M535 835 L396 835", from: 0.0, to: 0.38 },
  { id: "base-right", d: "M535 835 L674 835", from: 0.0, to: 0.38 },
  { id: "edge-left", d: "M398 835 L470 405", from: 0.12, to: 0.95 },
  { id: "edge-right", d: "M672 835 L600 405", from: 0.12, to: 0.95 },
  { id: "core", d: "M535 835 L535 455", from: 0.02, to: 1.0 },
  { id: "facet", d: "M545 718 L668 798", from: 0.55, to: 1.0 },
];

/** Phase 3 — branches : petit Y central, grandes branches latérales, bras supérieurs. */
export const BRANCH_STROKES: GrowingStroke[] = [
  { id: "fork-left", d: "M535 455 L490 415", from: 0.0, to: 0.2 },
  { id: "fork-right", d: "M535 455 L580 415", from: 0.0, to: 0.2 },
  { id: "limb-left-lower", d: "M535 612 L296 393", from: 0.06, to: 0.6 },
  { id: "limb-right-lower", d: "M535 612 L774 393", from: 0.06, to: 0.6 },
  { id: "limb-left-upper", d: "M497 412 L301 356 L296 393", from: 0.16, to: 0.74 },
  { id: "limb-right-upper", d: "M573 412 L769 356 L774 393", from: 0.16, to: 0.74 },
  { id: "arm-left", d: "M490 415 L476 350 L410 262 L431 246 L535 326", from: 0.2, to: 1.0 },
  { id: "arm-right", d: "M580 415 L594 350 L660 262 L639 246 L535 326", from: 0.2, to: 1.0 },
];

/**
 * Phase 4 — « feuilles » bleues : dans le logo officiel ce sont des nœuds de réseau
 * reliés par des tiges. Chaque groupe pousse depuis son point d'ancrage (`origin`).
 * L'ordre du tableau est l'ordre d'apparition.
 */
export interface LeafGroup {
  id: string;
  origin: { x: number; y: number };
  stems: string[];
  nodes: Array<{ x: number; y: number }>;
}

export const LEAF_GROUPS: LeafGroup[] = [
  { id: "low-left", origin: { x: 292, y: 396 }, stems: ["M292 396 L200 420"], nodes: [{ x: 200, y: 420 }] },
  { id: "low-right", origin: { x: 778, y: 396 }, stems: ["M778 396 L870 420"], nodes: [{ x: 870, y: 420 }] },
  { id: "mid-left", origin: { x: 292, y: 368 }, stems: ["M292 368 L200 318"], nodes: [{ x: 200, y: 318 }] },
  { id: "mid-right", origin: { x: 778, y: 368 }, stems: ["M778 368 L870 318"], nodes: [{ x: 870, y: 318 }] },
  { id: "tip-left", origin: { x: 300, y: 358 }, stems: ["M300 358 L240 250"], nodes: [{ x: 240, y: 250 }] },
  { id: "tip-right", origin: { x: 770, y: 358 }, stems: ["M770 358 L830 250"], nodes: [{ x: 830, y: 250 }] },
  { id: "arm-left", origin: { x: 408, y: 262 }, stems: ["M408 262 L323 262"], nodes: [{ x: 323, y: 262 }] },
  { id: "arm-right", origin: { x: 662, y: 262 }, stems: ["M662 262 L747 262"], nodes: [{ x: 747, y: 262 }] },
  {
    id: "triangle-left",
    origin: { x: 412, y: 248 },
    stems: ["M412 248 L240 176", "M412 248 L350 148", "M240 176 L350 148"],
    nodes: [{ x: 240, y: 176 }, { x: 350, y: 148 }],
  },
  {
    id: "triangle-right",
    origin: { x: 658, y: 248 },
    stems: ["M658 248 L830 176", "M658 248 L720 148", "M830 176 L720 148"],
    nodes: [{ x: 830, y: 176 }, { x: 720, y: 148 }],
  },
  { id: "crown-left", origin: { x: 452, y: 260 }, stems: ["M452 260 L448 198"], nodes: [{ x: 448, y: 198 }] },
  { id: "crown-right", origin: { x: 620, y: 260 }, stems: ["M620 260 L620 198"], nodes: [{ x: 620, y: 198 }] },
  { id: "crown-center", origin: { x: 562, y: 302 }, stems: ["M562 302 L532 198"], nodes: [{ x: 532, y: 198 }] },
  {
    id: "summit",
    origin: { x: 532, y: 198 },
    stems: ["M532 198 L415 90", "M532 198 L652 90", "M448 198 L535 48", "M415 90 L535 48 L652 90"],
    nodes: [{ x: 415, y: 90 }, { x: 535, y: 48 }, { x: 652, y: 90 }],
  },
];

/** Accolades { } du logo officiel. La droite est le miroir de la gauche autour de x = 535. */
export const BRACE_LEFT =
  "M168 150 C122 150 106 168 106 212 L106 300 C106 334 88 350 48 350 C88 350 106 366 106 400 L106 492 C106 534 122 552 168 552";
export const BRACE_RIGHT =
  "M902 150 C948 150 964 168 964 212 L964 300 C964 334 982 350 1022 350 C982 350 964 366 964 400 L964 492 C964 534 948 552 902 552";
export const BRACE_STROKE_WIDTH = 26;

/** Foyers des ondes : trois groupes de feuilles + un grand halo autour de la ramure. */
export const WAVE_SOURCES = [
  { id: "left", cx: 245, cy: 300, r: 165 },
  { id: "right", cx: 825, cy: 300, r: 165 },
  { id: "summit", cx: 535, cy: 115, r: 150 },
  { id: "crown", cx: 535, cy: 270, r: 420 },
] as const;

/**
 * Éclair : tracé brisé qui part bien au-dessus du dessin (le SVG déborde vers le haut)
 * et frappe exactement IMPACT_POINT. Les fourches partent de points du tracé principal.
 */
export const LIGHTNING_BOLT =
  "M650 -6000 L590 -4300 L655 -3200 L585 -2200 L610 -1500 L560 -1260 L628 -1150 L548 -900 L602 -780 L520 -520 L586 -380 L512 -120 L566 40 L506 300 L560 470 L512 660 L535 835";
export const LIGHTNING_FORKS = [
  "M548 -900 L470 -760 L488 -690 L430 -580",
  "M520 -520 L612 -430 L600 -360 L660 -270",
  "M506 300 L440 380 L452 430 L404 500",
];

/** Étincelles d'impact : directions déterministes (pas de hasard → rendu serveur identique). */
export function impactSparks(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI + (Math.PI * (index + 0.5)) / count; // demi-cercle supérieur
    const distance = 120 + ((index * 53) % 110);
    return {
      id: index,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance * 0.7),
      radius: 3 + (index % 3) * 1.5,
    };
  });
}

/** Particules ambiantes de la phase « l'arbre rayonne » (positions déterministes). */
export function ambientMotes(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    x: 150 + ((index * 389) % 780),
    y: 120 + ((index * 241) % 420),
    radius: 3 + (index % 3),
    drift: 40 + ((index * 17) % 50),
  }));
}
