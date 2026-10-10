import { Fragment } from "react";
import Link from "next/link";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { GitHubIcon } from "../icons";
import { BRAND, FOOTER_BAND_ITEMS, PENDING_LABEL } from "../landing-content";
import { FOOTER, type FooterLink } from "../sections-content";
import styles from "./SiteFooter.module.css";

function FooterEntry({ link, className }: { link: FooterLink; className: string }) {
  if (link.href) {
    return (
      <Link href={link.href} className={className}>
        {link.label}
      </Link>
    );
  }
  // Pas encore de page : affiché comme texte, sans faux lien.
  return (
    <span className={className} aria-disabled="true" title={PENDING_LABEL}>
      {link.label}
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brandBlock}>
            <Link href="/" className={styles.brand} aria-label={`${BRAND.name} — accueil`}>
              <BaobabMark className={styles.brandMark} title={null} />
              <span className={styles.brandText}>
                <span className={styles.brandName}>{BRAND.name}</span>
                <span className={styles.brandTagline}>{BRAND.tagline}</span>
              </span>
            </Link>
            <p className={styles.brandPitch}>{FOOTER.pitch}</p>
          </div>

          <nav className={styles.columns} aria-label="Pied de page">
            {FOOTER.columns.map((column) => (
              <div key={column.title} className={styles.column}>
                <h2 className={styles.columnTitle}>{column.title}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterEntry link={link} className={styles.columnLink} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.bottom}>
          <div className={styles.bottomLeft}>
            <span className={styles.copyright}>{FOOTER.copyright}</span>
            <ul className={styles.legal}>
              {FOOTER.legal.map((link) => (
                <li key={link.label}>
                  <FooterEntry link={link} className={styles.legalLink} />
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.bottomRight}>
            <p className={styles.band}>
              {FOOTER_BAND_ITEMS.map((item, index) => (
                <Fragment key={item}>
                  {index > 0 && (
                    <span className={styles.bandSeparator} aria-hidden="true">
                      •
                    </span>
                  )}
                  <span>{item}</span>
                </Fragment>
              ))}
            </p>
            <a
              className={styles.social}
              href={FOOTER.sourceCodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Code source du projet sur GitHub (nouvel onglet)"
            >
              <GitHubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
