"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/landing/icons";
import { DOCS_PILLARS, DOCS_UI } from "./docs-content";
import styles from "./Docs.module.css";

interface SearchEntry {
  label: string;
  section: string;
  href?: string;
}

const INDEX: SearchEntry[] = DOCS_PILLARS.flatMap((pillar) => [
  { label: pillar.title, section: "Rubrique", href: `/docs#${pillar.id}` },
  ...pillar.links.map((link) => ({ label: link.label, section: pillar.title, href: link.href })),
]);

/** Retire accents et casse pour une recherche tolérante (« securite » trouve « Sécurité »). */
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Recherche dans l'index des guides (100 % dans le navigateur, aucun envoi).
 * Ctrl + K (ou ⌘ + K) place le curseur dans le champ.
 */
export function DocsSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘ K");
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const input = inputRef.current;
        // Un seul champ réagit : celui qui est visible.
        if (!input || input.offsetParent === null) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return INDEX.filter((entry) => {
      const haystack = normalize(`${entry.label} ${entry.section}`);
      return words.every((word) => haystack.includes(word));
    }).slice(0, 8);
  }, [query]);

  return (
    <div className={styles.search} data-compact={compact || undefined} role="search">
      <label className={styles.searchField}>
        <SearchIcon aria-hidden="true" />
        <span className="bb-visually-hidden">{DOCS_UI.searchLabel}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={DOCS_UI.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          aria-controls={listId}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd aria-hidden="true">{shortcut}</kbd>
      </label>
      <div id={listId} className={styles.searchResults} hidden={query.trim() === ""}>
        <p className="bb-visually-hidden" role="status">
          {query.trim() === "" ? "" : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
        </p>
        {results.length === 0 ? (
          <p className={styles.searchEmpty}>{DOCS_UI.searchEmpty}</p>
        ) : (
          <ul>
            {results.map((entry) => (
              <li key={`${entry.section}-${entry.label}`}>
                {entry.href ? (
                  <Link href={entry.href} className={styles.searchResult} onClick={() => setQuery("")}>
                    <span>{entry.label}</span>
                    <small>{entry.section}</small>
                  </Link>
                ) : (
                  <span className={styles.searchResult} aria-disabled="true">
                    <span>{entry.label}</span>
                    <small>
                      {entry.section} · {DOCS_UI.soon}
                    </small>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Sommaire « Sur cette page » : met en évidence la partie visible. */
export function DocsToc({ items }: { items: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const targets = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -55% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={styles.toc} aria-label={DOCS_UI.onThisPage}>
      <p className={styles.tocTitle}>{DOCS_UI.onThisPage}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
