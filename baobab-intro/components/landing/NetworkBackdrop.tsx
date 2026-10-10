import styles from "./Hero.module.css";

/**
 * Motif de réseau en arrière-plan : lignes fines et nœuds bleu très pâle.
 * Généré une seule fois à la compilation (composant serveur) avec un tirage
 * pseudo-aléatoire à graine fixe : le rendu est identique à chaque chargement,
 * sans JavaScript côté navigateur.
 */
const WIDTH = 1600;
const HEIGHT = 900;
const COLUMNS = 11;
const ROWS = 7;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNetwork() {
  const random = seededRandom(20261010);
  const cellW = WIDTH / (COLUMNS - 1);
  const cellH = HEIGHT / (ROWS - 1);
  const nodes: Array<{ x: number; y: number; r: number }> = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      nodes.push({
        x: Math.round(column * cellW + (random() - 0.5) * cellW * 0.8),
        y: Math.round(row * cellH + (random() - 0.5) * cellH * 0.8),
        r: random() < 0.22 ? 9 + Math.round(random() * 5) : 3 + Math.round(random() * 3),
      });
    }
  }
  const edges: Array<[number, number]> = [];
  nodes.forEach((node, index) => {
    const nearest = nodes
      .map((other, otherIndex) => ({ otherIndex, distance: Math.hypot(other.x - node.x, other.y - node.y) }))
      .filter(({ otherIndex }) => otherIndex > index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    for (const { otherIndex, distance } of nearest) {
      if (distance < cellW * 1.45 && random() < 0.85) edges.push([index, otherIndex]);
    }
  });
  return { nodes, edges };
}

const NETWORK = buildNetwork();

export function NetworkBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.backdropGlowBlue} />
      <div className={styles.backdropGlowWarm} />
      <svg
        className={styles.network}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g stroke="currentColor" strokeWidth="1.2" fill="none">
          {NETWORK.edges.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={NETWORK.nodes[a].x} y1={NETWORK.nodes[a].y} x2={NETWORK.nodes[b].x} y2={NETWORK.nodes[b].y} />
          ))}
        </g>
        <g fill="currentColor">
          {NETWORK.nodes.map((node, index) => (
            <circle key={index} cx={node.x} cy={node.y} r={node.r} opacity={node.r > 8 ? 0.55 : 0.9} />
          ))}
        </g>
      </svg>
    </div>
  );
}
