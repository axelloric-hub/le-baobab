import type { ReactNode } from "react";
import styles from "./Pill.module.css";

export type PillTone = "neutral" | "blue" | "green" | "amber" | "red" | "brown";

/** Pastille d'état (statut d'une candidature, d'une commande, d'un cours…). La couleur double toujours un texte. */
export function Pill({ tone = "neutral", children, dot }: { tone?: PillTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={styles.pill} data-tone={tone} data-dot={dot || undefined}>
      {children}
    </span>
  );
}
