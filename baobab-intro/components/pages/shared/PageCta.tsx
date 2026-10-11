import { MemberLink } from "@/components/auth/MemberLink";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/landing/icons";
import sections from "@/components/landing/sections/Sections.module.css";
import styles from "./Pages.module.css";

interface PageCtaProps {
  id: string;
  eyebrow?: string;
  title: string;
  text: string;
  /** Libellé du bouton principal (mène à la création de compte). */
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
            <MemberLink to="register" className={sections.ctaPrimary}>
              {primary}
              <ArrowRightIcon aria-hidden="true" />
            </MemberLink>
            {extra}
          </div>
        </div>
      </div>
    </section>
  );
}
