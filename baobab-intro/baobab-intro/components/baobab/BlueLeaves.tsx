import type { CSSProperties } from "react";
import { BAOBAB_INTRO_CONFIG, TIMELINE, segment, timing } from "./animation-config";
import {
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACE_STROKE_WIDTH,
  LEAF_GROUPS,
  NODE_RADIUS,
  STEM_STROKE_WIDTH,
} from "./tree-geometry";
import styles from "./BaobabIntro.module.css";

const { colors, leaves, ambience, layout } = BAOBAB_INTRO_CONFIG;

const STEM_STAGGER_MS = 40;
const NODE_STAGGER_MS = 45;

/** Durée totale de croissance d'un groupe (tiges puis nœuds). */
function groupSpanMs(group: (typeof LEAF_GROUPS)[number]) {
  const stemsEnd = (group.stems.length - 1) * STEM_STAGGER_MS + leaves.stemDrawMs;
  const nodesEnd = leaves.stemDrawMs * 0.7 + (group.nodes.length - 1) * NODE_STAGGER_MS + leaves.nodePopMs;
  return Math.max(stemsEnd, nodesEnd);
}

/**
 * Calcule le début de chaque groupe de feuilles pour que le dernier ait
 * entièrement poussé à la fin de la phase 4, quel que soit le nombre de groupes.
 */
function leafSchedule() {
  const phase = TIMELINE.phases.leaves;
  const groupDuration = Math.max(...LEAF_GROUPS.map(groupSpanMs));
  const idealSpan = leaves.groupStaggerMs * (LEAF_GROUPS.length - 1);
  const availableSpan = Math.max(0, phase.duration - groupDuration);
  const stagger = idealSpan > availableSpan ? availableSpan / (LEAF_GROUPS.length - 1) : leaves.groupStaggerMs;
  return { start: phase.start, stagger };
}

/**
 * Phase 4 — les feuilles bleues (les nœuds de réseau du logo).
 * Chaque groupe : la tige s'allonge depuis la branche, puis le nœud éclot
 * (opacité + échelle + légère rotation). Les accolades { } se tracent en fin de phase.
 */
export function BlueLeaves() {
  const schedule = leafSchedule();
  const braceWindow = segment("leaves", 0.5, 1);
  const halo = segment("waves", 0, 1);
  const sway = segment("waitBeforeWordmark");

  return (
    <g>
      {layout.showBraces && (
        <g fill="none" stroke={colors.braces} strokeWidth={BRACE_STROKE_WIDTH} strokeLinecap="butt" strokeLinejoin="round">
          {[BRACE_LEFT, BRACE_RIGHT].map((brace) => (
            <path
              key={brace}
              d={brace}
              pathLength={1}
              className={`${styles.drawStroke} ${styles.braceStroke} ${styles.animated}`}
              style={timing(braceWindow.start, braceWindow.duration)}
            />
          ))}
        </g>
      )}

      {/* Le frémissement de la ramure pivote autour du sommet du tronc */}
      <g
        className={`${styles.crownSway} ${styles.viewBoxOrigin} ${styles.animated}`}
        style={
          {
            ...timing(sway.start, sway.duration),
            transformOrigin: "535px 455px",
            "--sway": `${ambience.swayDeg}deg`,
          } as CSSProperties
        }
      >
        {LEAF_GROUPS.map((group, index) => {
          const groupStart = schedule.start + index * schedule.stagger;
          const groupStyle = {
            ...timing(groupStart, groupSpanMs(group)),
            transformOrigin: `${group.origin.x}px ${group.origin.y}px`,
            "--leaf-rotation": `${leaves.groupRotationDeg * (group.origin.x < 535 ? -1 : 1)}deg`,
          } as CSSProperties;

          return (
            <g key={group.id} className={`${styles.leafGroup} ${styles.viewBoxOrigin} ${styles.animated}`} style={groupStyle}>
              <g fill="none" stroke={colors.leaves} strokeWidth={STEM_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
                {group.stems.map((stem, stemIndex) => (
                  <path
                    key={stem}
                    d={stem}
                    pathLength={1}
                    className={`${styles.drawStroke} ${styles.leafStem} ${styles.animated}`}
                    style={timing(groupStart + stemIndex * STEM_STAGGER_MS, leaves.stemDrawMs)}
                  />
                ))}
              </g>
              {group.nodes.map((node, nodeIndex) => {
                const popStart = groupStart + leaves.stemDrawMs * 0.7 + nodeIndex * NODE_STAGGER_MS;
                return (
                  <g key={`${node.x}-${node.y}`}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={NODE_RADIUS}
                      fill={colors.leafHighlight}
                      className={`${styles.nodeHalo} ${styles.fillBox} ${styles.animated}`}
                      style={timing(halo.start + (index % 4) * 70, 900)}
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={NODE_RADIUS}
                      fill={colors.leaves}
                      className={`${styles.leafNode} ${styles.fillBox} ${styles.animated}`}
                      style={timing(popStart, leaves.nodePopMs)}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    </g>
  );
}
