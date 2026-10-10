/**
 * LE BAOBAB — configuration centrale de la cinématique d'ouverture.
 *
 * Tous les réglages modifiables (durées, couleurs, tailles, intensités) sont ici.
 * Les composants ne contiennent aucune valeur « magique » de temps ou de couleur :
 * ils lisent ce fichier.
 *
 * Toutes les durées sont en millisecondes.
 */

export const BAOBAB_INTRO_CONFIG = {
  /**
   * Durée de chaque phase, dans l'ordre. Le début de chaque phase est calculé
   * automatiquement : modifier une durée décale les phases suivantes.
   * Total de référence : 450 + 850 + 1050 + 1100 + 550 + 2000 + 1000 = 7000 ms.
   */
  phaseDurations: {
    /** Phase 1 — l'éclair frappe le sol (0,00 → 0,45 s) */
    lightning: 450,
    /** Phase 2 — le tronc émerge du sol (0,45 → 1,30 s) = vitesse de croissance du tronc */
    trunk: 850,
    /** Phase 3 — les branches se développent (1,30 → 2,35 s) = vitesse des branches */
    branches: 1050,
    /** Phase 4 — les feuilles bleues poussent (2,35 → 3,45 s) */
    leaves: 1100,
    /** Phase 5 — les ondes bleues apparaissent (3,45 → 4,00 s) */
    waves: 550,
    /** Phase 6 — attente obligatoire : l'arbre rayonne avant l'arrivée du texte (4,00 → 6,00 s) */
    waitBeforeWordmark: 2000,
    /** Phase 7 — « LE BAOBAB » arrive et pousse l'arbre (6,00 → 7,00 s) */
    wordmark: 1000,
  },

  colors: {
    /** Couleurs officielles mesurées sur le logo de référence */
    trunk: "#8A3A12",
    leaves: "#3479EE",
    leafHighlight: "#7FB2FF",
    braces: "#3479EE",
    wordmark: "#8A3A12",

    lightningCore: "#F4FAFF",
    lightningGlow: "#4FA3FF",
    impactSpark: "#BFE0FF",

    waves: "#3479EE",
  },

  background: {
    /** Fond nocturne du début (avant l'impact) */
    night: "#050B18",
    nightGlow: "#0E2A55",
    /** Fond final, clair comme le logo officiel */
    day: "#FBF8F3",
    dayGlow: "#E7EEFB",
    /** Couleur de l'éclat plein écran à l'impact */
    flash: "#EAF3FF",
    /** Intensité maximale de l'éclat (0 → 1). Mettre 0 pour le supprimer. */
    flashOpacity: 0.95,
  },

  lightning: {
    /** Fraction de la phase 1 consacrée à la descente de l'éclair (le reste = scintillement puis extinction) */
    strikeFraction: 0.3,
    /** Nombre d'étincelles projetées par l'impact */
    sparkCount: 14,
  },

  leaves: {
    /** Décalage entre deux groupes de feuilles successifs */
    groupStaggerMs: 62,
    /** Durée de croissance d'une tige bleue */
    stemDrawMs: 230,
    /** Durée d'éclosion d'un nœud (feuille) */
    nodePopMs: 300,
    /** Rotation initiale d'un groupe de feuilles, en degrés */
    groupRotationDeg: -10,
  },

  waves: {
    /** Nombre d'anneaux émis par foyer d'ondes (3 foyers + 1 halo global) */
    ringsPerSource: 3,
    /** Opacité maximale d'un anneau */
    peakOpacity: 0.55,
    /** Durée d'un cycle de « respiration » d'un anneau */
    periodMs: 2400,
    /** Opacité globale des ondes une fois le logo composé (ne doit pas concurrencer le nom) */
    finalLayerOpacity: 0.45,
    /** Épaisseur des anneaux (unités du dessin de l'arbre) */
    strokeWidth: 5,
  },

  ambience: {
    /** Particules discrètes qui flottent pendant la phase « l'arbre rayonne » */
    moteCount: 9,
    /** Amplitude du léger frémissement de la ramure (degrés) */
    swayDeg: 1.1,
  },

  layout: {
    /**
     * Hauteur de l'arbre. Exprimée en unités de conteneur (cqh / cqw) : la
     * cinématique s'adapte à la taille de son conteneur, pas seulement à la fenêtre.
     */
    logoHeight: "min(38cqh, 23cqw)",
    /** Espace entre l'arbre et le texte, en fraction de la hauteur de l'arbre */
    gapRatio: 0.07,
    /** Taille du texte en fraction de la hauteur de l'arbre */
    wordmarkSizeRatio: 0.42,
    /**
     * Distance parcourue par le texte, en multiple de la hauteur de l'arbre.
     * 2,6 = il part du bord droit d'un écran 16:9. Plus grand = il vient de plus loin.
     */
    wordmarkTravelRatio: 2.6,
    /**
     * Largeur de « LE BAOBAB » en em pour la police utilisée (Outfit Bold = 5,553).
     * Sert de valeur de secours avant la mesure réelle et au calcul de la poussée.
     */
    wordmarkWidthEm: 5.553,
    /** Décalage final de toute la composition (0 = parfaitement centrée) */
    lockupOffsetX: "0px",
    lockupOffsetY: "0px",
    /** Afficher les accolades { } du logo officiel autour de la ramure */
    showBraces: true,
  },

  /** Mode « animations réduites » (préférence système) : affichage du logo en fondu */
  reducedMotion: {
    fadeInMs: 700,
    holdMs: 1300,
  },
} as const;

export type BaobabIntroConfig = typeof BAOBAB_INTRO_CONFIG;
export type PhaseName = keyof BaobabIntroConfig["phaseDurations"];

export interface PhaseWindow {
  start: number;
  end: number;
  duration: number;
}

/** Chronologie unique, calculée à partir des durées ci-dessus. */
function buildTimeline(durations: BaobabIntroConfig["phaseDurations"]) {
  let cursor = 0;
  const windows = {} as Record<PhaseName, PhaseWindow>;
  for (const phase of Object.keys(durations) as PhaseName[]) {
    const duration = durations[phase];
    windows[phase] = { start: cursor, end: cursor + duration, duration };
    cursor += duration;
  }
  return { phases: windows, totalMs: cursor };
}

export const TIMELINE = buildTimeline(BAOBAB_INTRO_CONFIG.phaseDurations);

/** Durée totale réelle de la cinématique (7000 ms avec les réglages de référence). */
export const TOTAL_DURATION_MS = TIMELINE.totalMs;

/**
 * Fenêtre d'animation située entre deux fractions (0 → 1) d'une phase.
 * Exemple : segment("trunk", 0, 0.5) = première moitié de la phase du tronc.
 */
export function segment(phase: PhaseName, from = 0, to = 1) {
  const window = TIMELINE.phases[phase];
  const start = window.start + window.duration * from;
  const end = window.start + window.duration * to;
  return { start, duration: Math.max(1, end - start) };
}

/** Style React d'animation CSS pilotée par le temps (délai + durée explicites). */
export function timing(start: number, duration: number) {
  return {
    animationDelay: `${Math.round(start)}ms`,
    animationDuration: `${Math.round(duration)}ms`,
  };
}
