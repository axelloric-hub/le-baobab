import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/sections/SiteFooter";
import styles from "@/components/landing/LandingPage.module.css";

/**
 * Gabarit des pages intérieures (Communauté, Blog, Docs) : même en-tête, même pied
 * de page et même fond que l'accueil. Pas de cinématique ici : elle reste réservée à « / ».
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}
