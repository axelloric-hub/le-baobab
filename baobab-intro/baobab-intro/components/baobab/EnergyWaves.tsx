import type { CSSProperties } from "react";
import { BAOBAB_INTRO_CONFIG, segment, timing } from "./animation-config";
import { WAVE_SOURCES } from "./tree-geometry";
import styles from "./BaobabIntro.module.css";

const { colors, waves } = BAOBAB_INTRO_CONFIG;

/**
 * Phase 5 — ondes bleues concentriques autour des groupes de feuilles.
 * Chaque foyer émet une salve de `ringsPerSource` anneaux qui s'agrandissent
 * en s'effaçant, puis la salve se répète (« respiration ») toutes les `periodMs`.
 * Les ondes sont dessinées DERRIÈRE l'arbre : elles ne masquent jamais les feuilles.
 * Pendant la phase 7, toute la couche s'atténue pour laisser la vedette au nom.
 */
export function EnergyWaves() {
  const start = segment("waves").start;
  const settle = segment("wordmark");

  return (
    <g
      className={`${styles.wavesLayer} ${styles.animated}`}
      style={timing(settle.start, settle.duration)}
      fill="none"
      stroke={colors.waves}
      strokeWidth={waves.strokeWidth}
      aria-hidden="true"
    >
      {WAVE_SOURCES.map((source, sourceIndex) =>
        Array.from({ length: waves.ringsPerSource }, (_, ringIndex) => {
          const isCrownHalo = source.id === "crown";
          const style = {
            ...timing(start + sourceIndex * 70 + ringIndex * 150, waves.periodMs),
            "--wave-peak": String(waves.peakOpacity * (isCrownHalo ? 0.45 : 1) * (1 - ringIndex * 0.18)),
          } as CSSProperties;
          return (
            <circle
              key={`${source.id}-${ringIndex}`}
              cx={source.cx}
              cy={source.cy}
              r={source.r * (1 - ringIndex * 0.16)}
              strokeWidth={isCrownHalo ? waves.strokeWidth * 0.7 : waves.strokeWidth}
              className={`${styles.wave} ${styles.fillBox} ${styles.animated}`}
              style={style}
            />
          );
        }),
      )}
    </g>
  );
}
