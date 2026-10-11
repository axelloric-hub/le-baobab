import Link from "next/link";
import type { ReactNode } from "react";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { ArrowLeftIcon, CheckIcon } from "@/components/landing/icons";
import { BRAND, PENDING_LABEL } from "@/components/landing/landing-content";
import { ROUTES } from "@/lib/routes";
import { AUTH_COMMON, AUTH_PANEL } from "./auth-content";
import styles from "./Auth.module.css";

interface AuthShellProps {
  /** Grande phrase du panneau de marque (ordinateur). */
  panelTitle: string;
  children: ReactNode;
}

/**
 * Gabarit des écrans d'authentification.
 * Ordinateur : panneau de marque brun à gauche, formulaire à droite.
 * Téléphone : bandeau brun compact en haut (comme la maquette Stitch), puis le formulaire.
 */
export function AuthShell({ panelTitle, children }: AuthShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.panel}>
        <div className={styles.panelRings} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <Link href={ROUTES.discover} prefetch={false} className={styles.panelBrand} aria-label={`${BRAND.name} — découvrir la plateforme`}>
          <BaobabMark className={styles.panelMark} title={null} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{BRAND.name}</span>
            <span className={styles.brandTagline}>{BRAND.tagline}</span>
          </span>
        </Link>
        <div className={styles.panelBody}>
          <p className={styles.panelTitle}>{panelTitle}</p>
          <p className={styles.panelMotto}>{AUTH_PANEL.motto}</p>
          <ul className={styles.panelPoints}>
            {AUTH_PANEL.points.map((point) => (
              <li key={point}>
                <span aria-hidden="true">
                  <CheckIcon />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileBar}>
          <Link href={ROUTES.discover} prefetch={false} className={styles.mobileBack} aria-label={AUTH_COMMON.back}>
            <ArrowLeftIcon aria-hidden="true" />
          </Link>
          <Link href={ROUTES.discover} prefetch={false} className={styles.mobileBrand} aria-label={`${BRAND.name} — découvrir la plateforme`}>
            <BaobabMark className={styles.mobileMark} title={null} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>{BRAND.name}</span>
              <span className={styles.brandTagline}>{BRAND.tagline}</span>
            </span>
          </Link>
        </header>

        <div className={styles.topLink}>
          <Link href={ROUTES.discover} prefetch={false} className={styles.backLink}>
            <ArrowLeftIcon aria-hidden="true" />
            {AUTH_COMMON.back}
          </Link>
        </div>

        <main className={styles.content}>{children}</main>

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} LE BAOBAB</span>
          {AUTH_COMMON.legal.map((label) => (
            <span key={label} aria-disabled="true" title={PENDING_LABEL}>
              {label}
            </span>
          ))}
        </footer>
      </div>
    </div>
  );
}
