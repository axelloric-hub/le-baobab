import type { ReactNode } from "react";
import styles from "./Sections.module.css";

interface SectionHeadingProps {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
}

/** En-tête de section commun : sur-titre, titre (h2), chapô. */
export function SectionHeading({ id, eyebrow, title, lead, align = "center" }: SectionHeadingProps) {
  return (
    <header className={styles.heading} data-align={align}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  );
}

/**
 * Action affichée mais pas encore raccordée (aucune page derrière) :
 * même apparence qu'un bouton, aucune navigation, signalée aux lecteurs d'écran.
 */
export function PendingButton({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button type="button" className={className} aria-disabled="true" title="Bientôt disponible" data-pending="">
      {children}
    </button>
  );
}

/** Petite mention « données de démo » sous un bloc de chiffres. */
export function DemoNotice({ children = "Chiffres de démonstration — à remplacer par des données réelles." }: { children?: ReactNode }) {
  return <p className={styles.demoNotice}>{children}</p>;
}
