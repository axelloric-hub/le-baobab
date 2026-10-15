import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import styles from "./EntityHeader.module.css";
import { Skeleton } from "./States";
import { VerifiedIcon } from "./icons";

interface EntityHeaderProps {
  name: string;
  coverUrl?: string | null;
  avatarUrl?: string | null;
  /** « square » : logo d'organisation (groupe, entreprise, boutique) ; « round » : personne. */
  shape?: "square" | "round";
  verified?: boolean;
  tagline?: ReactNode;
  /** Éléments <li> (confidentialité, nombre de membres, lieu…). */
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Contenu ajouté sous la description (liens, chiffres). */
  children?: ReactNode;
}

/** En-tête d'une entité : couverture, logo, actions, nom (titre de la page), repères et description. */
export function EntityHeader({ name, coverUrl, avatarUrl, shape = "square", verified, tagline, meta, description, actions, children }: EntityHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.cover}>
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée
          <img src={coverUrl} alt="" />
        )}
      </div>
      <div className={styles.identity}>
        <div className={styles.avatarRow}>
          <span className={styles.avatarRing} data-shape={shape}>
            <Avatar name={name} src={avatarUrl} size={96} />
          </span>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.name}>{name}</h1>
            {verified && (
              <span className={styles.verified} title="Vérifié par LE BAOBAB">
                <VerifiedIcon />
                <span className="bb-visually-hidden">Vérifié</span>
              </span>
            )}
          </div>
          {tagline && <p className={styles.tagline}>{tagline}</p>}
        </div>
        {meta && <ul className={styles.meta}>{meta}</ul>}
        {description && <p className={styles.description}>{description}</p>}
        {children}
      </div>
    </header>
  );
}

export function EntityHeaderSkeleton() {
  return (
    <div className={styles.header} aria-hidden="true">
      <div className={styles.cover} />
      <div className={styles.identity} style={{ paddingTop: 16 }}>
        <Skeleton width={96} height={96} radius={18} style={{ marginTop: -60 }} />
        <Skeleton width="40%" height={28} />
        <Skeleton width="30%" height={14} />
      </div>
    </div>
  );
}
