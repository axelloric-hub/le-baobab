import { DemoButton } from "../DemoButton";
import { ArrowRightIcon, PlayIcon } from "../icons";
import { CTA_BANNER, SECTION_IDS } from "../sections-content";
import { PendingButton } from "./SectionHeading";
import styles from "./Sections.module.css";

export function CtaBanner() {
  const headingId = `${SECTION_IDS.cta}-titre`;
  return (
    <section id={SECTION_IDS.cta} className={styles.sectionTight} aria-labelledby={headingId}>
      <div className={styles.container}>
        <div className={`${styles.cta} ${styles.reveal}`}>
          <div className={styles.ctaRings} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2 id={headingId} className={styles.ctaTitle}>
            {CTA_BANNER.title}
          </h2>
          <p className={styles.ctaText}>{CTA_BANNER.text}</p>
          <div className={styles.ctaActions}>
            {/* Aucun parcours d'inscription n'existe encore : bouton visuel, sans action. */}
            <PendingButton className={styles.ctaPrimary}>
              {CTA_BANNER.primary}
              <ArrowRightIcon aria-hidden="true" />
            </PendingButton>
            <DemoButton className={styles.ctaSecondary}>
              <PlayIcon aria-hidden="true" />
              {CTA_BANNER.secondary}
            </DemoButton>
          </div>
        </div>
      </div>
    </section>
  );
}
