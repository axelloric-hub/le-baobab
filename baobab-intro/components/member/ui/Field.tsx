import type { ReactNode } from "react";
import ui from "./ui.module.css";

/** Champ de formulaire : libellé, aide, erreur reliée au champ (aria-describedby côté champ : `${id}-error`). */
export function Field({ id, label, error, hint, children, optional }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode; optional?: boolean }) {
  return (
    <div>
      <label className={ui.label} htmlFor={id}>
        {label}
        {optional && <span style={{ fontWeight: 500, color: "var(--bb-ink-muted)" }}> (facultatif)</span>}
      </label>
      {children}
      {hint && !error && <p className={ui.hint}>{hint}</p>}
      {error && (
        <p className={ui.fieldError} id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** « Développeurs Django à Douala » → « developpeurs-django-a-douala » (adresse lisible, sans accents). */
export function slugify(text: string, max = 80): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}
