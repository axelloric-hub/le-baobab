import { CheckIcon, LockIcon, ShieldIcon } from "../icons";
import { SECTION_IDS, SECURITY } from "../sections-content";
import styles from "./Sections.module.css";

export function SecuritySection() {
  const headingId = `${SECTION_IDS.security}-titre`;
  return (
    <section id={SECTION_IDS.security} className={styles.sectionTight} aria-labelledby={headingId}>
      <div className={styles.container}>
        <div className={`${styles.securityCard} ${styles.reveal}`}>
          <div className={styles.securityBadge}>
            <span className={styles.securityIcon} aria-hidden="true">
              <ShieldIcon />
            </span>
            <h3 className={styles.securityBadgeTitle}>{SECURITY.badge.title}</h3>
            <p className={styles.securityBadgeText}>{SECURITY.badge.text}</p>
            <span className={styles.securityTag}>
              <LockIcon aria-hidden="true" />
              {SECURITY.badge.tag}
            </span>
          </div>
          <div className={styles.securityCopy}>
            <p className={styles.eyebrow}>{SECURITY.eyebrow}</p>
            <h2 id={headingId} className={`${styles.title} ${styles.securityTitle}`}>
              {SECURITY.title}
            </h2>
            <p className={styles.securityText}>{SECURITY.text}</p>
            <ul className={styles.checkChips}>
              {SECURITY.checks.map((check) => (
                <li key={check}>
                  <CheckIcon aria-hidden="true" />
                  {check}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
