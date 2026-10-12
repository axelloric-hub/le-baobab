"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import type { UserBrief } from "@/features/social/types";
import { authed } from "@/lib/api/authed";
import { Avatar } from "../ui/Avatar";
import { CloseIcon } from "../ui/icons";
import ui from "../ui/ui.module.css";
import styles from "./Composer.module.css";

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Audience personnalisée : recherche de membres (GET /users/?q=) et liste des personnes choisies. */
export function AudiencePicker({ value, onChange }: { value: UserBrief[]; onChange: (users: UserBrief[]) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const q = useDebounced(query.trim().replace(/^@/, ""), 250);
  const inputId = useId();
  const listId = useId();
  const search = useQuery({
    queryKey: ["users", "search", q],
    queryFn: () => authed<UserBrief[]>(`/users/?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
  const results = (search.data ?? []).filter((u) => !value.some((v) => v.username === u.username));
  const open = q.length >= 2 && query.trim().length >= 2;

  const pick = (user: UserBrief) => {
    onChange([...value, user]);
    setQuery("");
    setActive(0);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.people}>
        <label className={ui.label} htmlFor={inputId}>
          Choisir les personnes
        </label>
        <input
          id={inputId}
          className={ui.input}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].username}` : undefined}
          placeholder="Nom ou @pseudo"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(results[active] ?? results[0]);
            }
          }}
        />
        {open && (
          <ul id={listId} role="listbox" className={styles.results} aria-label="Membres trouvés">
            {search.isPending && <li className={styles.result}>Recherche…</li>}
            {!search.isPending && results.length === 0 && <li className={styles.result}>Aucun membre trouvé.</li>}
            {results.map((user, index) => (
              <li key={user.username} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${listId}-${user.username}`}
                  aria-selected={index === active}
                  tabIndex={-1}
                  className={styles.result}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(user)}
                >
                  <Avatar name={user.display_name || user.username} src={user.avatar_url} size={28} />
                  <span>{user.display_name || user.username}</span>
                  <small>@{user.username}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <ul className={styles.chips} aria-label="Personnes choisies">
          {value.map((user) => (
            <li key={user.username} className={styles.chipItem}>
              {user.display_name || user.username}
              <button type="button" aria-label={`Retirer ${user.display_name || user.username}`} onClick={() => onChange(value.filter((v) => v.username !== user.username))}>
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length === 0 && <p className={ui.hint}>Ajoutez au moins une personne.</p>}
    </div>
  );
}
