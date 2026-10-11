import {
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACE_STROKE_WIDTH,
  BRANCH_STROKES,
  LEAF_GROUPS,
  NODE_RADIUS,
  STEM_STROKE_WIDTH,
  TREE_VIEWBOX,
  TRUNK_STROKES,
  TRUNK_STROKE_WIDTH,
} from "./tree-geometry";
import { BAOBAB_INTRO_CONFIG } from "./animation-config";

const { colors } = BAOBAB_INTRO_CONFIG;

interface BaobabMarkProps {
  className?: string;
  /** Halo bleu doux autour des nœuds (grand format uniquement). */
  glow?: boolean;
  /** Afficher les accolades { } du logo officiel. */
  braces?: boolean;
  /** Texte alternatif ; `null` = décoratif (masqué aux lecteurs d'écran). */
  title?: string | null;
}

/**
 * Le symbole LE BAOBAB, version statique.
 * Il est tracé avec EXACTEMENT la même géométrie que la cinématique
 * (tree-geometry.ts) : le logo de la page et celui de l'animation sont identiques.
 * Composant serveur : aucun JavaScript envoyé au navigateur.
 */
export function BaobabMark({ className, glow = false, braces = true, title = "LE BAOBAB" }: BaobabMarkProps) {
  const nodes = LEAF_GROUPS.flatMap((group) => group.nodes);
  const decorative = title === null;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${TREE_VIEWBOX.width} ${TREE_VIEWBOX.height}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
    >
      {glow && (
        <>
          <defs>
            <radialGradient id="baobab-mark-node-glow">
              <stop offset="0%" stopColor={colors.leafHighlight} stopOpacity="0.55" />
              <stop offset="45%" stopColor={colors.leaves} stopOpacity="0.16" />
              <stop offset="100%" stopColor={colors.leaves} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g>
            {nodes.map((node) => (
              <circle key={`glow-${node.x}-${node.y}`} cx={node.x} cy={node.y} r={NODE_RADIUS * 3} fill="url(#baobab-mark-node-glow)" />
            ))}
          </g>
        </>
      )}

      {braces && (
        <g fill="none" stroke={colors.braces} strokeWidth={BRACE_STROKE_WIDTH} strokeLinejoin="round">
          <path d={BRACE_LEFT} />
          <path d={BRACE_RIGHT} />
        </g>
      )}

      <g fill="none" stroke={colors.trunk} strokeWidth={TRUNK_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
        {[...TRUNK_STROKES, ...BRANCH_STROKES].map((stroke) => (
          <path key={stroke.id} d={stroke.d} />
        ))}
      </g>

      <g fill="none" stroke={colors.leaves} strokeWidth={STEM_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
        {LEAF_GROUPS.flatMap((group) => group.stems).map((stem) => (
          <path key={stem} d={stem} />
        ))}
      </g>

      <g fill={colors.leaves}>
        {nodes.map((node) => (
          <circle key={`node-${node.x}-${node.y}`} cx={node.x} cy={node.y} r={NODE_RADIUS} />
        ))}
      </g>
    </svg>
  );
}
