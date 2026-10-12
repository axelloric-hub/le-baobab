"use client";

import { useId } from "react";
import type { Visibility } from "@/features/social/types";
import { CheckIcon } from "../ui/icons";
import { VISIBILITIES } from "../ui/visibility";
import styles from "./Composer.module.css";

interface VisibilityPickerProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  /** Visibilités proposées (ex. : pas « Membres du groupe » sans groupe, pas pour un statut). */
  allowed?: Visibility[];
  legend?: string;
  compact?: boolean;
}

/** Choix de l'audience : groupe de boutons radio natifs (clavier : flèches), une ligne par visibilité. */
export function VisibilityPicker({ value, onChange, allowed, legend = "Qui peut voir ?", compact }: VisibilityPickerProps) {
  const name = useId();
  const options = VISIBILITIES.filter((v) => !allowed || allowed.includes(v.value));
  return (
    <fieldset className={styles.visibility} data-compact={compact || undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.visibilityGrid}>
        {options.map(({ value: option, label, hint, Icon }) => (
          <label key={option} className={styles.visibilityOption} data-checked={option === value || undefined}>
            <input type="radio" name={name} value={option} checked={option === value} onChange={() => onChange(option)} className={styles.visibilityInput} />
            <Icon className={styles.visibilityIcon} />
            <span className={styles.visibilityText}>
              <span className={styles.visibilityLabel}>{label}</span>
              {!compact && <span className={styles.visibilityHint}>{hint}</span>}
            </span>
            <span className={styles.visibilityRadio} aria-hidden="true">
              {option === value && <CheckIcon />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
