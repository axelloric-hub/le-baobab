import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import sections from "@/components/landing/sections/Sections.module.css";
import styles from "./Pages.module.css";

interface PageCtaProps {
  id: string;
  eyebrow?: string;
  title: string;
  text: string;
  /** Libellé du bouton principal (inscription : pas encore raccordée, bouton visuel). */
  primary: string;
  /** Actions supplémentaires (liens réels ou boutons en attente). */
  extra?: ReactNode;
}

/** Bandeau brun de fin de page, même signature que celui de l'accueil. */
export function PageCta({ id, eyebrow, title, text, primary, extra }: PageCtaProps) {
  const headingId = `${id}-titre`;
  return (
    <section id={id} className={sections.sectionTight} aria-labelledby={headingId}>
      <div className={sections.container}>
        <div className={`${sections.cta} ${styles.pageCta} ${sections.reveal}`}>
          <div className={sections.ctaRings} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {eyebrow && <p className={styles.ctaEyebrow}>{eyebrow}</p>}
          <h2 id={headingId} className={`${sections.ctaTitle} ${styles.pageCtaTitle}`}>
            {title}
          </h2>
          <p className={sections.ctaText}>{text}</p>
          <div className={sections.ctaActions}>
            <PendingButton className={sections.ctaPrimary}>
              {primary}
              <ArrowRightIcon aria-hidden="true" />
            </PendingButton>
            {extra}
          </div>
        </div>
      </div>
    </section>
  );
}
