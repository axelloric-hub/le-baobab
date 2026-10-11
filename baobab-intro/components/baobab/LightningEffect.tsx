import type { CSSProperties } from "react";
import { BAOBAB_INTRO_CONFIG, segment, timing } from "./animation-config";
import { IMPACT_POINT, LIGHTNING_BOLT, LIGHTNING_FORKS, impactSparks } from "./tree-geometry";
import styles from "./BaobabIntro.module.css";

const { colors, lightning } = BAOBAB_INTRO_CONFIG;

/** Moment où l'éclair touche le sol (ms depuis le début). */
export const STRIKE_TIME = segment("lightning", 0, lightning.strikeFraction);

/**
 * Phase 1 — éclair, impact, onde de choc au sol et étincelles.
 * Rendu à l'intérieur du SVG de l'arbre : l'impact tombe donc toujours
 * exactement au pied du tronc, quelle que soit la taille de l'écran.
 */
export function LightningEffect() {
  const strikeEnd = STRIKE_TIME.start + STRIKE_TIME.duration;
  const phase = segment("lightning");
  const sparks = impactSparks(lightning.sparkCount);
  const boltLayers = [
    { width: 38, color: colors.lightningGlow, opacity: 0.14 },
    { width: 16, color: colors.lightningGlow, opacity: 0.4 },
    { width: 6, color: colors.lightningCore, opacity: 1 },
  ];

  return (
    <g aria-hidden="true">
      {/* L'éclair : dessiné en ~120 ms puis scintille et s'éteint à la fin de la phase */}
      <g className={`${styles.lightning} ${styles.animated}`} style={timing(phase.start, phase.duration)}>
        {boltLayers.map((layer) => (
          <g key={layer.width} stroke={layer.color} strokeOpacity={layer.opacity} strokeWidth={layer.width}>
            <path
              d={LIGHTNING_BOLT}
              pathLength={1}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`${styles.drawStroke} ${styles.boltStroke} ${styles.animated}`}
              style={timing(STRIKE_TIME.start, STRIKE_TIME.duration)}
            />
            {LIGHTNING_FORKS.map((fork, index) => (
              <path
                key={fork}
                d={fork}
                pathLength={1}
                fill="none"
                strokeWidth={layer.width * 0.55}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`${styles.drawStroke} ${styles.boltStroke} ${styles.animated}`}
                style={timing(STRIKE_TIME.start + 20 + index * 22, STRIKE_TIME.duration * 0.7)}
              />
            ))}
          </g>
        ))}
      </g>

      {/* Lueur d'impact */}
      <circle
        cx={IMPACT_POINT.x}
        cy={IMPACT_POINT.y}
        r={170}
        fill="url(#baobab-impact-glow)"
        className={`${styles.impactGlow} ${styles.fillBox} ${styles.animated}`}
        style={timing(strikeEnd - 10, 620)}
      />

      {/* Onde de choc circulaire, aplatie pour suivre le sol */}
      {[0, 1].map((ring) => (
        <ellipse
          key={ring}
          cx={IMPACT_POINT.x}
          cy={IMPACT_POINT.y}
          rx={ring === 0 ? 440 : 300}
          ry={ring === 0 ? 46 : 30}
          fill="none"
          stroke={ring === 0 ? colors.lightningGlow : colors.lightningCore}
          strokeWidth={ring === 0 ? 5 : 3}
          className={`${styles.shockwave} ${styles.fillBox} ${styles.animated}`}
          style={timing(strikeEnd + ring * 70, 560 + ring * 80)}
        />
      ))}

      {/* Étincelles projetées */}
      {sparks.map((spark) => (
        <circle
          key={spark.id}
          cx={IMPACT_POINT.x}
          cy={IMPACT_POINT.y - 6}
          r={spark.radius}
          fill={colors.impactSpark}
          className={`${styles.spark} ${styles.fillBox} ${styles.animated}`}
          style={
            {
              ...timing(strikeEnd + (spark.id % 4) * 12, 460 + (spark.id % 5) * 50),
              "--dx": `${spark.dx}px`,
              "--dy": `${spark.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </g>
  );
}
