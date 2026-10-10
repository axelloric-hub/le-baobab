import type { CSSProperties } from "react";
import { BAOBAB_INTRO_CONFIG, segment, timing, type PhaseName } from "./animation-config";
import {
  BRANCH_STROKES,
  IMPACT_POINT,
  TREE_VIEWBOX,
  TRUNK_STROKES,
  TRUNK_STROKE_WIDTH,
  ambientMotes,
  type GrowingStroke,
} from "./tree-geometry";
import { BlueLeaves } from "./BlueLeaves";
import { EnergyWaves } from "./EnergyWaves";
import { LightningEffect } from "./LightningEffect";
import styles from "./BaobabIntro.module.css";

const { colors, ambience } = BAOBAB_INTRO_CONFIG;

function GrowingStrokes({ strokes, phase }: { strokes: GrowingStroke[]; phase: PhaseName }) {
  return (
    <>
      {strokes.map((stroke) => {
        const phaseWindow = segment(phase, stroke.from, stroke.to);
        return (
          <path
            key={stroke.id}
            d={stroke.d}
            pathLength={1}
            className={`${styles.drawStroke} ${styles.growStroke} ${styles.animated}`}
            style={timing(phaseWindow.start, phaseWindow.duration)}
          />
        );
      })}
    </>
  );
}

/**
 * L'arbre complet : ondes (derrière), tronc, branches, feuilles, accolades,
 * particules et éclair (devant). Le SVG déborde vers le haut pour laisser
 * l'éclair descendre depuis le haut de l'écran.
 */
export function BaobabTree() {
  const trunkPhase = segment("trunk");
  const core = TRUNK_STROKES.find((stroke) => stroke.id === "core")!;
  const coreWindow = segment("trunk", core.from, core.to);
  const glowPhase = segment("waitBeforeWordmark");
  const motes = ambientMotes(ambience.moteCount);

  return (
    <svg
      className={styles.treeSvg}
      viewBox={`0 0 ${TREE_VIEWBOX.width} ${TREE_VIEWBOX.height}`}
      role="img"
      aria-label="Arbre du logo LE BAOBAB"
    >
      <defs>
        <radialGradient id="baobab-impact-glow">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="25%" stopColor={colors.lightningGlow} stopOpacity="0.75" />
          <stop offset="100%" stopColor={colors.lightningGlow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="baobab-ground-shadow">
          <stop offset="0%" stopColor="#0B1B3A" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0B1B3A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ombre douce au sol, qui ancre l'arbre */}
      <ellipse
        cx={IMPACT_POINT.x}
        cy={IMPACT_POINT.y + 14}
        rx={260}
        ry={26}
        fill="url(#baobab-ground-shadow)"
        className={`${styles.groundShadow} ${styles.animated}`}
        style={timing(trunkPhase.start, trunkPhase.duration)}
      />

      <EnergyWaves />

      {/* Phases 2 et 3 — tronc puis branches, en traits qui s'allongent */}
      <g
        fill="none"
        stroke={colors.trunk}
        strokeWidth={TRUNK_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <GrowingStrokes strokes={TRUNK_STROKES} phase="trunk" />
        <GrowingStrokes strokes={BRANCH_STROKES} phase="branches" />
      </g>

      {/* Pousse à l'impact, puis point d'énergie qui monte avec l'axe du tronc */}
      <g className={`${styles.sprout} ${styles.fillBox} ${styles.animated}`} style={timing(trunkPhase.start - 40, 420)}>
        <circle cx={IMPACT_POINT.x} cy={IMPACT_POINT.y - 14} r={14} fill={colors.leaves} />
      </g>
      <circle
        cx={IMPACT_POINT.x}
        cy={IMPACT_POINT.y}
        r={11}
        fill={colors.leafHighlight}
        stroke="#ffffff"
        strokeWidth={4}
        className={`${styles.growthTip} ${styles.viewBoxOrigin} ${styles.animated}`}
        style={timing(coreWindow.start, coreWindow.duration)}
      />

      <BlueLeaves />

      {/* Phase 6 — particules discrètes */}
      <g fill={colors.leaves}>
        {motes.map((mote) => (
          <circle
            key={mote.id}
            cx={mote.x}
            cy={mote.y}
            r={mote.radius}
            className={`${styles.mote} ${styles.fillBox} ${styles.animated}`}
            style={
              {
                ...timing(glowPhase.start - 300 + mote.id * 210, 3200),
                "--drift": `${mote.drift}px`,
              } as CSSProperties
            }
          />
        ))}
      </g>

      <LightningEffect />
    </svg>
  );
}
