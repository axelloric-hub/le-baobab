"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { usePeopleSearch } from "@/features/people/hooks";
import { useTrending } from "@/features/social/hooks";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { TAG_RE } from "../post/rich-text";
import { Avatar } from "../ui/Avatar";
import { Dialog } from "../ui/Dialog";
import { BookmarkIcon, HashIcon, HomeIcon, ImageIcon, PenIcon, SearchIcon, TrendingIcon } from "../ui/icons";
import { useCreation } from "./creation-context";
import styles from "./Shell.module.css";

interface Entry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}



/**
 * Recherche rapide (Ctrl + K) : aller à une page, ouvrir un hashtag, créer.
 * Motif ARIA « combobox » : la saisie garde le focus, flèches pour choisir, Entrée pour valider.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <PaletteDialog onClose={onClose} /> : null;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { openPost, openStatus } = useCreation();
  const trending = useTrending();
  const [query, setQuery] = useState("");
  const people = usePeopleSearch(query.trim().startsWith("#") ? "" : query);
  const [active, setActive] = useState(0);
  const listId = useId();

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const q = query.trim().toLowerCase();
    const tag = q.replace(/^#/, "");
    const list: Entry[] = [];

    if (!q.startsWith("#")) {
      for (const user of (people.data ?? []).slice(0, 6)) {
        list.push({
          id: `user-${user.username}`,
          group: "Personnes",
          label: user.display_name || user.username,
          hint: `@${user.username}`,
          icon: <Avatar name={user.display_name || user.username} src={user.avatar_url} size={24} />,
          run: go(ROUTES.profile(user.username)),
        });
      }
    }

    if (tag && TAG_RE.test(tag)) {
      list.push({ id: `tag-${tag}`, group: "Hashtag", label: `#${tag}`, hint: "Voir les publications", icon: <HashIcon />, run: go(ROUTES.hashtag(tag)) });
    }

    const pages: Entry[] = [
      { id: "feed", group: "Aller à", label: "Fil d'actualité", icon: <HomeIcon />, run: go(ROUTES.feed) },
      { id: "saved", group: "Aller à", label: "Mes enregistrements", icon: <BookmarkIcon />, run: go(ROUTES.saved) },
      {
        id: "new-post",
        group: "Créer",
        label: "Créer une publication",
        icon: <PenIcon />,
        run: () => {
          onClose();
          openPost();
        },
      },
      {
        id: "new-status",
        group: "Créer",
        label: "Créer un statut",
        icon: <ImageIcon />,
        run: () => {
          onClose();
          openStatus();
        },
      },
    ];
    list.push(...pages.filter((entry) => !q || entry.label.toLowerCase().includes(q.replace(/^#/, ""))));

    for (const item of trending.data ?? []) {
      if (tag && !item.tag.includes(tag)) continue;
      if (item.tag === tag) continue;
      list.push({
        id: `trend-${item.tag}`,
        group: "Tendances",
        label: `#${item.tag}`,
        hint: plural(item.posts_7d, "publication", "publications"),
        icon: <TrendingIcon />,
        run: go(ROUTES.hashtag(item.tag)),
      });
      if (list.length > 14) break;
    }
    return list;
  }, [query, trending.data, people.data, router, onClose, openPost, openStatus]);

  const current = Math.min(active, Math.max(0, entries.length - 1));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + delta + entries.length) % Math.max(1, entries.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      entries[current]?.run();
    }
  };

  let lastGroup = "";

  return (
    <Dialog open onClose={onClose} title="Rechercher" size="md" className={styles.palette}>
      <div className={styles.paletteInput}>
        <SearchIcon />
        <input
          data-autofocus
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={entries[current] ? `${listId}-${entries[current].id}` : undefined}
          aria-label="Rechercher une personne, un hashtag ou une page"
          placeholder="Une personne, #python, une page…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          enterKeyHint="go"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Résultats" className={styles.paletteList}>
        {entries.map((entry, index) => {
          const heading = entry.group !== lastGroup ? entry.group : null;
          lastGroup = entry.group;
          return (
            <li key={entry.id} role="presentation">
              {heading && (
                <p className={styles.paletteGroup} aria-hidden="true">
                  {heading}
                </p>
              )}
              <button
                type="button"
                id={`${listId}-${entry.id}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === current}
                className={styles.paletteItem}
                onMouseMove={() => setActive(index)}
                onClick={entry.run}
              >
                {entry.icon}
                <span>{entry.label}</span>
                {entry.hint && <small>{entry.hint}</small>}
              </button>
            </li>
          );
        })}
      </ul>
      {entries.length === 0 && <p className={styles.paletteEmpty}>Aucun résultat. Tapez au moins deux lettres pour chercher une personne ; un hashtag s&apos;écrit avec des lettres, des chiffres ou «&nbsp;_&nbsp;».</p>}
    </Dialog>
  );
}
