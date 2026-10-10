/**
 * Phase 7 — mouvement « poussé » de l'arbre.
 *
 * Le texte glisse avec une courbe d'accélération CSS (WORDMARK_EASING).
 * L'arbre ne bouge pas tant que le texte ne l'a pas « touché » ; ensuite il
 * recule exactement au rythme du texte, en gardant l'écart final entre les deux.
 * On échantillonne cette relation pour produire des keyframes CSS : le
 * mouvement reste piloté par le temps (aucune dépendance au nombre d'images/s).
 */
import { BAOBAB_INTRO_CONFIG } from "./animation-config";

/** Courbe du texte : départ vif, arrivée très douce. Doit rester identique à celle du CSS. */
export const WORDMARK_EASING = [0.33, 1, 0.68, 1] as const;
export const TREE_PUSH_KEYFRAMES_NAME = "baobab-tree-push";

/** Évalue une courbe cubic-bezier(x1, y1, x2, y2) CSS pour une progression temporelle t (0 → 1). */
export function cubicBezier(t: number, [x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const coordinate = (u: number, a: number, b: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u ** 2 * (1 - u) + u ** 3;
  let low = 0;
  let high = 1;
  let u = t;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    u = (low + high) / 2;
    if (coordinate(u, x1, x2) < t) low = u;
    else high = u;
  }
  return coordinate(u, y1, y2);
}

/**
 * Rapport « distance parcourue par le texte / recul total de l'arbre ».
 * Les deux sont proportionnels à la hauteur du logo, donc le rapport est constant.
 */
export function travelToShiftRatio() {
  const { layout } = BAOBAB_INTRO_CONFIG;
  const shiftRatio = (layout.wordmarkSizeRatio * layout.wordmarkWidthEm + layout.gapRatio) / 2;
  return layout.wordmarkTravelRatio / shiftRatio;
}

/** Position de l'arbre (1 = décalé au centre, 0 = position finale) en fonction du temps (0 → 1). */
export function treePushProgress(t: number, ratio = travelToShiftRatio()) {
  const textOffset = ratio * (1 - cubicBezier(t, WORDMARK_EASING)); // en unités de « recul de l'arbre »
  const softness = 0.12; // arrondit le moment du contact (pas d'à-coup de vitesse)
  const softMin = (a: number, b: number) => (a + b - Math.sqrt((a - b) ** 2 + softness ** 2)) / 2;
  const startValue = softMin(1, ratio);
  const endValue = softMin(1, 0);
  return (softMin(1, textOffset) - endValue) / (startValue - endValue);
}

/** Keyframes CSS générées à partir de la configuration (insérées par BaobabIntro). */
export function buildTreePushKeyframes(samples = 48) {
  const stops = Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    const progress = Math.max(0, Math.min(1, treePushProgress(t)));
    return `${(t * 100).toFixed(2)}%{transform:translateX(calc(var(--tree-shift) * ${progress.toFixed(4)}))}`;
  });
  return `@keyframes ${TREE_PUSH_KEYFRAMES_NAME}{${stops.join("")}}`;
}
