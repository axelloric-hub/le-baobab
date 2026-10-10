"use client";

import { useId, useState } from "react";
import {
  CheckIcon,
  EyeIcon,
  GlobeIcon,
  ListIcon,
  LockIcon,
  UserCheckIcon,
  UsersIcon,
  UserStarIcon,
  HubIcon,
} from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import { COMMUNITY_PRIVACY, ILLUSTRATIVE, type VisibilityIcon } from "./community-content";
import shared from "../shared/Pages.module.css";
import styles from "./Community.module.css";

const ICONS: Record<VisibilityIcon, typeof GlobeIcon> = {
  globe: GlobeIcon,
  userCheck: UserCheckIcon,
  users: UsersIcon,
  userStar: UserStarIcon,
  group: HubIcon,
  list: ListIcon,
  lock: LockIcon,
};

/**
 * Maquette interactive du choix de visibilité : de vrais boutons radio (clavier compris),
 * sans aucun envoi — c'est un aperçu.
 */
export function VisibilityPicker() {
  const [value, setValue] = useState(COMMUNITY_PRIVACY.defaultOption);
  const name = useId();

  return (
    <div className={shared.mock}>
      <fieldset className={styles.visibility}>
        <legend className={styles.visibilityLegend}>
          <EyeIcon aria-hidden="true" />
          {COMMUNITY_PRIVACY.mockTitle}
        </legend>
        <div className={styles.visibilityList}>
          {COMMUNITY_PRIVACY.options.map((option) => {
            const Icon = ICONS[option.icon];
            const checked = value === option.value;
            return (
              <label key={option.value} className={styles.visibilityOption} data-checked={checked || undefined}>
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={checked}
                  onChange={() => setValue(option.value)}
                  className={styles.visibilityInput}
                />
                <Icon aria-hidden="true" className={styles.visibilityIcon} />
                <span className={styles.visibilityLabel}>{option.label}</span>
                <span className={styles.visibilityRadio} aria-hidden="true">
                  {checked && <CheckIcon />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.visibilityFooter}>
        <PendingButton className={styles.smallBrownButton}>{COMMUNITY_PRIVACY.applyLabel}</PendingButton>
        <span className={shared.illustrative}>{ILLUSTRATIVE}</span>
      </div>
    </div>
  );
}
