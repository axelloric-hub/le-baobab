import { SECTION_IDS, STATS } from "../sections-content";
import { DemoNotice } from "./SectionHeading";
import styles from "./Sections.module.css";

export function StatsSection() {
  return (
    <section id={SECTION_IDS.stats} className={styles.sectionTight} aria-label="LE BAOBAB en quelques repères">
      <div className={styles.container}>
        <ul className={styles.statGrid} data-demo={STATS.isDemo || undefined}>
          {STATS.items.map((stat) => (
            <li key={stat.title} className={`${styles.statCard} ${styles.reveal}`}>
              <span className={styles.statValue}>{stat.value}</span>
              <h3 className={styles.statTitle}>{stat.title}</h3>
              <p className={styles.statText}>{stat.text}</p>
              <span className={styles.statTag}>
                <span className={styles.statDot} aria-hidden="true" />
                {stat.tag}
              </span>
            </li>
          ))}
        </ul>
        {STATS.showDemoNotice && <DemoNotice />}
      </div>
    </section>
  );
}
