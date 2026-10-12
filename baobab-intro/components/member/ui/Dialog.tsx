"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import styles from "./ui.module.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Élément à gauche du titre (avatar, icône). */
  leading?: ReactNode;
  /** Empêche la fermeture (envoi en cours). */
  busy?: boolean;
  className?: string;
  bodyClassName?: string;
}

/**
 * Boîte de dialogue modale sur l'élément <dialog> natif : piège du focus, touche Échap,
 * couche supérieure et inertie du reste de la page sont fournis par le navigateur.
 * Sur mobile, elle s'affiche en feuille qui monte du bas (CSS).
 */
export function Dialog({ open, onClose, title, children, footer, size = "md", leading, busy, className, bodyClassName }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      // Focus initial : le champ marqué data-autofocus, sinon le navigateur choisit (premier élément focalisable).
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus?.();
    }
  }, [open]);

  // Démontage pendant l'ouverture (changement de page) : on referme proprement.
  useEffect(() => () => ref.current?.close(), []);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${className ?? ""}`}
      data-size={size}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        // Clic sur le voile (hors du contenu) : fermeture.
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      {open && (
        <>
          <header className={styles.dialogHeader}>
            {leading}
            <h2 id={titleId} className={styles.dialogTitle}>
              {title}
            </h2>
            <button type="button" className={styles.iconButton} onClick={onClose} disabled={busy} aria-label="Fermer">
              <CloseIcon />
            </button>
          </header>
          <div className={`${styles.dialogBody} ${bodyClassName ?? ""}`}>{children}</div>
          {footer && <footer className={styles.dialogFooter}>{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
