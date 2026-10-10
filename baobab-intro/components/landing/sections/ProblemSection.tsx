import { BaobabMark } from "@/components/baobab/BaobabMark";
import { PROBLEM, SECTION_IDS } from "../sections-content";
import styles from "./Sections.module.css";

/** Positions (en %) des outils éparpillés autour de l'arbre, dans le visuel. */
const SCATTER_POSITIONS = [
  { x: 18, y: 18 },
  { x: 80, y: 14 },
  { x: 88, y: 62 },
  { x: 50, y: 92 },
  { x: 12, y: 70 },
];

export function ProblemSection() {
  const headingId = `${SECTION_IDS.problem}-titre`;
  return (
    <section id={SECTION_IDS.problem} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.container}>
        <div className={`${styles.problemCard} ${styles.reveal}`}>
          <div className={styles.problemCopy}>
            <p className={styles.eyebrow}>{PROBLEM.eyebrow}</p>
            <h2 id={headingId} className={`${styles.title} ${styles.problemTitle}`}>
              {PROBLEM.title}
            </h2>
            <p className={styles.problemBody}>{PROBLEM.body}</p>
            <p className={styles.problemAnswer}>{PROBLEM.answer}</p>
          </div>

          {/* Visuel : cinq outils dispersés, reliés à un seul arbre. */}
          <div className={styles.scatter} aria-hidden="true">
            <svg className={styles.scatterLines} viewBox="0 0 100 100" preserveAspectRatio="none">
              {SCATTER_POSITIONS.map((point) => (
                <line key={`${point.x}-${point.y}`} x1={point.x} y1={point.y} x2="50" y2="50" />
              ))}
            </svg>
            <div className={styles.scatterCenter}>
              <BaobabMark className={styles.scatterMark} title={null} />
            </div>
            {PROBLEM.scattered.map((tool, index) => (
              <span
                key={tool}
                className={styles.scatterChip}
                style={{ left: `${SCATTER_POSITIONS[index].x}%`, top: `${SCATTER_POSITIONS[index].y}%` }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
