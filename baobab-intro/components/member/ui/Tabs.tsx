"use client";

import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Tabs.module.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  Icon?: (props: React.SVGProps<SVGSVGElement>) => ReactNode;
  /** Pastille de compteur (masquée à 0 ou si absente). */
  count?: number;
}

/**
 * Onglet actif reflété dans l'adresse (?onglet=…) pour pouvoir partager ou recharger la page sur le même onglet.
 * Le premier onglet est la valeur par défaut (absent de l'adresse).
 */
export function useUrlTab<T extends string>(ids: readonly T[], param = "onglet") {
  const [tab, setTab] = useState<T>(ids[0]);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(param) as T | null;
    if (fromUrl && ids.includes(fromUrl)) setTab(fromUrl);
    // ids est une liste constante définie par la page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);
  const select = useCallback(
    (next: T) => {
      setTab(next);
      const url = new URL(window.location.href);
      if (next === ids[0]) url.searchParams.delete(param);
      else url.searchParams.set(param, next);
      window.history.replaceState(null, "", url);
    },
    [ids, param],
  );
  return [tab, select] as const;
}

/** Barre d'onglets (motif ARIA « tabs ») : flèches gauche/droite, Début, Fin. Collante sous la barre supérieure. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  sticky = true,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  sticky?: boolean;
}) {
  const onKey = (event: KeyboardEvent) => {
    const index = items.findIndex((t) => t.id === value);
    const go = (i: number) => {
      event.preventDefault();
      const next = items[(i + items.length) % items.length].id;
      onChange(next);
      document.getElementById(`${idPrefix}-onglet-${next}`)?.focus();
    };
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(items.length - 1);
  };
  return (
    <div className={cx(styles.tabs, sticky && styles.sticky)} role="tablist" aria-label={label} onKeyDown={onKey}>
      {items.map(({ id, label: text, Icon, count }) => (
        <button
          key={id}
          id={`${idPrefix}-onglet-${id}`}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={value === id}
          aria-controls={`${idPrefix}-panneau-${id}`}
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
        >
          {Icon && <Icon aria-hidden="true" />}
          {text}
          {count ? <span className={styles.count}>{count > 99 ? "99+" : count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Panneau associé à l'onglet actif (animation d'entrée à chaque changement). */
export function TabPanel({ idPrefix, id, children, className }: { idPrefix: string; id: string; children: ReactNode; className?: string }) {
  return (
    <div id={`${idPrefix}-panneau-${id}`} key={id} role="tabpanel" aria-labelledby={`${idPrefix}-onglet-${id}`} className={cx(styles.panel, className)}>
      {children}
    </div>
  );
}
