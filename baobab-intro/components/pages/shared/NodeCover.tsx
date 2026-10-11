import styles from "./Pages.module.css";

/**
 * Couverture abstraite « réseau de nœuds » (brun et bleu de la charte), générée de façon
 * déterministe à partir d'un numéro : identique côté serveur et côté navigateur.
 */
function random(seed: number) {
  let state = (seed * 9301 + 49297) % 233280;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

interface NodeCoverProps {
  variant: number;
  className?: string;
  /** Formes « cartes d'architecture » en plus des nœuds (grand format). */
  detailed?: boolean;
}

export function NodeCover({ variant, className, detailed = false }: NodeCoverProps) {
  const rand = random(variant + 3);
  const width = 500;
  const height = 320;
  const count = detailed ? 6 : 5;
  const nodes = Array.from({ length: count }, (_, index) => ({
    x: 60 + (index * (width - 120)) / (count - 1) + (rand() - 0.5) * 50,
    y: 70 + rand() * (height - 140),
    r: 10 + rand() * 14,
    blue: (index + variant) % 3 !== 1,
  }));
  const curve = `M20 ${height - 50 - rand() * 60} C ${width * 0.3} ${rand() * height}, ${width * 0.6} ${height - rand() * 80}, ${width - 20} ${40 + rand() * 80}`;
  const dashed = `M20 ${60 + rand() * 80} C ${width * 0.35} ${height * 0.6}, ${width * 0.65} ${rand() * 60}, ${width - 20} ${height - 60}`;

  return (
    <svg
      className={`${styles.cover} ${className ?? ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-tone={variant % 2 === 0 ? "warm" : "cool"}
    >
      <path d={curve} stroke="#6f2c0e" strokeOpacity="0.22" strokeWidth="2" fill="none" />
      <path d={dashed} stroke="#2563eb" strokeOpacity="0.32" strokeWidth="1.8" strokeDasharray="6 5" fill="none" />
      {nodes.slice(1).map((node, index) => (
        <line
          key={`l${index}`}
          x1={nodes[index].x}
          y1={nodes[index].y}
          x2={node.x}
          y2={node.y}
          stroke={node.blue ? "#2563eb" : "#6f2c0e"}
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
      ))}
      {nodes.map((node, index) => (
        <g key={`n${index}`}>
          <circle cx={node.x} cy={node.y} r={node.r} fill={node.blue ? "#d9e2ff" : "#ffe2d7"} />
          <circle cx={node.x} cy={node.y} r={node.r * 0.4} fill={node.blue ? "#2563eb" : "#6f2c0e"} />
        </g>
      ))}
      {detailed && (
        <>
          <g transform="translate(64 40)">
            <rect width="118" height="42" rx="8" fill="#fff" fillOpacity="0.88" />
            <circle cx="16" cy="21" r="4.5" fill="#2563eb" />
            <rect x="30" y="15" width="70" height="5" rx="2.5" fill="#6f2c0e" fillOpacity="0.35" />
            <rect x="30" y="24" width="46" height="4" rx="2" fill="#6f2c0e" fillOpacity="0.2" />
          </g>
          <g transform="translate(320 232)">
            <rect width="124" height="46" rx="8" fill="#fff" fillOpacity="0.9" />
            <circle cx="18" cy="23" r="5" fill="#6f2c0e" />
            <rect x="32" y="17" width="72" height="5" rx="2.5" fill="#2563eb" fillOpacity="0.6" />
            <rect x="32" y="27" width="46" height="4" rx="2" fill="#2563eb" fillOpacity="0.3" />
          </g>
        </>
      )}
    </svg>
  );
}
