import type { CSSProperties } from "react";
import { CodeBracesIcon, MentorIcon, SchoolIcon } from "./icons";
import { FEATURES, type FeatureIcon } from "./landing-content";
import styles from "./Hero.module.css";

const ICONS: Record<FeatureIcon, typeof CodeBracesIcon> = {
  code: CodeBracesIcon,
  mentor: MentorIcon,
  school: SchoolIcon,
};

/** Les trois espaces fondateurs (Communauté, Learn, Showcase) : cartes informatives. */
export function FeatureCards() {
  return (
    <ul className={styles.features} aria-label="Les trois espaces fondateurs">
      {FEATURES.map((feature, index) => {
        const Icon = ICONS[feature.icon];
        return (
          <li
            key={feature.title}
            className={`${styles.card} ${styles.revealCard}`}
            style={{ "--reveal-delay": `${200 + index * 80}ms` } as CSSProperties}
          >
            <span className={styles.cardIcon} aria-hidden="true">
              <Icon />
            </span>
            <span className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{feature.title}</h2>
              <p className={styles.cardText}>{feature.description}</p>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
