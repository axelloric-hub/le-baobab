"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronDownIcon, CloseIcon } from "./icons";
import styles from "./ui.module.css";
import { useVisualViewport } from "./use-visual-viewport";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /**
   * Présentation sur mobile : « fullscreen » pour les formulaires (défaut, sauf size="sm"),
   * « sheet » pour un choix court ou une confirmation.
   */
  mobile?: "fullscreen" | "sheet";
  /** Élément à gauche du titre (avatar, icône). */
  leading?: ReactNode;
  /** Empêche la fermeture (envoi en cours). */
  busy?: boolean;
  className?: string;
  bodyClassName?: string;
}

const MOBILE = "(max-width: 639px)";

/**
 * Boîte de dialogue modale sur l'élément <dialog> natif : piège du focus, touche Échap,
 * couche supérieure et inertie du reste de la page sont fournis par le navigateur.
 */
export function Dialog({ open, onClose, title, children, footer, size = "md", mobile, leading, busy, className, bodyClassName }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const variant = mobile ?? (size === "sm" ? "sheet" : "fullscreen");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      // Focus initial : le champ marqué data-autofocus ; sur mobile, pas de clavier imposé à l'ouverture
      // d'une simple feuille de choix.
      const target = dialog.querySelector<HTMLElement>("[data-autofocus]");
      target?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus?.();
    }
  }, [open]);

  // Démontage pendant l'ouverture (changement de page) : on referme proprement.
  useEffect(() => () => ref.current?.close(), []);

  useVisualViewport(ref, open);

  /** Indique s'il y a du contenu au-dessus (ombre de l'en-tête) ou en dessous (ombre du pied + « Suite »). */
  const measure = useCallback(() => {
    const body = bodyRef.current;
    const dialog = ref.current;
    if (!body || !dialog) return;
    dialog.toggleAttribute("data-scrolled", body.scrollTop > 2);
    dialog.toggleAttribute("data-more", body.scrollTop + body.clientHeight < body.scrollHeight - 8);
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!open || !body) return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(body);
    const mutations = new MutationObserver(measure);
    mutations.observe(body, { childList: true, subtree: true });
    // Un champ qui reçoit le focus est amené dans la partie visible du corps.
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (window.matchMedia(MOBILE).matches && target.matches("input, textarea, select")) {
        window.setTimeout(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }), 280);
      }
    };
    body.addEventListener("focusin", onFocus);
    return () => {
      resize.disconnect();
      mutations.disconnect();
      body.removeEventListener("focusin", onFocus);
    };
  }, [open, measure]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${className ?? ""}`}
      data-size={size}
      data-mobile={variant}
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
          <div ref={bodyRef} className={`${styles.dialogBody} ${bodyClassName ?? ""}`} onScroll={measure}>
            {children}
          </div>
          {footer ? (
            <footer className={styles.dialogFooter}>
              <MoreHint bodyRef={bodyRef} />
              {footer}
            </footer>
          ) : null}
        </>
      )}
    </dialog>
  );
}

/** Pastille « Suite » : visible quand le formulaire continue plus bas ; un appui fait défiler. */
function MoreHint({ bodyRef }: { bodyRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <button
      type="button"
      className={styles.moreHint}
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => {
        const body = bodyRef.current;
        body?.scrollBy({ top: body.clientHeight * 0.75, behavior: "smooth" });
      }}
    >
      <ChevronDownIcon />
      Suite
    </button>
  );
}
