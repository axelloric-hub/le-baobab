"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./ui.module.css";

export type MenuEntry =
  | { kind?: "item"; label: string; icon?: ReactNode; onSelect: () => void; tone?: "danger"; disabled?: boolean }
  | { kind: "link"; label: string; icon?: ReactNode; href: string }
  | { kind: "separator" };

interface MenuProps {
  /** Contenu du bouton déclencheur. */
  trigger: ReactNode;
  label: string;
  items: MenuEntry[];
  triggerClassName?: string;
  align?: "left" | "right";
  side?: "bottom" | "top";
}

/**
 * Menu d'actions (motif ARIA « menu button ») : flèches haut/bas, Début/Fin, Échap,
 * fermeture au clic extérieur, retour du focus sur le bouton.
 */
export function Menu({ trigger, label, items, triggerClassName, align = "right", side = "bottom" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusables = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    focusables()[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const list = focusables();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(list.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") close(false);
  };

  return (
    <div className={styles.menuRoot} ref={rootRef} onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName ?? styles.iconButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <ul id={menuId} role="menu" aria-label={label} className={styles.menu} data-align={align} data-side={side}>
          {items.map((entry, index) =>
            entry.kind === "separator" ? (
              <li key={index} role="separator" className={styles.menuSeparator} />
            ) : entry.kind === "link" ? (
              <li key={index} role="none">
                <Link role="menuitem" href={entry.href} className={styles.menuItem} onClick={() => close(false)}>
                  {entry.icon}
                  {entry.label}
                </Link>
              </li>
            ) : (
              <li key={index} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  data-tone={entry.tone}
                  aria-disabled={entry.disabled || undefined}
                  onClick={() => {
                    if (entry.disabled) return;
                    close(true);
                    entry.onSelect();
                  }}
                >
                  {entry.icon}
                  {entry.label}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
