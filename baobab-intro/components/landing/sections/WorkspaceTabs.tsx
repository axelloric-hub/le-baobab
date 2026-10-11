"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Workspace.module.css";

interface WorkspaceTabsProps {
  labels: string[];
  /** Panneaux rendus côté serveur : tous présents dans le HTML (référencement), un seul visible. */
  panels: ReactNode[];
}

/**
 * Onglets accessibles (motif WAI-ARIA « Tabs ») :
 * flèches gauche/droite, Début/Fin, focus itinérant, activation automatique.
 */
export function WorkspaceTabs({ labels, panels }: WorkspaceTabsProps) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const next = (index + labels.length) % labels.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: labels.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key]);
    }
  };

  return (
    <div className={styles.tabs}>
      <div className={styles.tabListWrap}>
        <div className={styles.tabList} role="tablist" aria-label="Espaces de la plateforme">
          {labels.map((label, index) => (
            <button
              key={label}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={index === active}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={index === active ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {panels.map((panel, index) => (
        <div
          key={labels[index]}
          role="tabpanel"
          id={`${baseId}-panel-${index}`}
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={index !== active}
          tabIndex={0}
          className={styles.panel}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
