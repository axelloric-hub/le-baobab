"use client";

import Link from "next/link";
import type { Group } from "@/features/community/types";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { GlobeIcon, LockIcon, UsersIcon } from "../ui/icons";
import { Skeleton } from "../ui/States";
import styles from "./Community.module.css";
import { JoinButton } from "./JoinButton";
import { PRIVACY, roleLabel } from "./labels";

export function PrivacyBadge({ privacy }: { privacy: Group["privacy"] }) {
  const Icon = privacy === "public" ? GlobeIcon : LockIcon;
  return (
    <span className={styles.badge} data-privacy={privacy}>
      <Icon aria-hidden="true" />
      {PRIVACY[privacy].label}
    </span>
  );
}

/** Carte de groupe (grille Découvrir / Mes groupes). Toute la carte mène au groupe ; le bouton d'adhésion reste distinct. */
export function GroupCard({ group }: { group: Group }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardCover} aria-hidden="true">
        {group.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img src={group.cover_url} alt="" loading="lazy" />
        )}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardAvatar}>
          <Avatar name={group.name} src={group.avatar_url} size={56} />
        </span>
        <h3 className={styles.cardTitle}>
          <Link href={ROUTES.group(group.slug)} className={styles.cardLink}>
            {group.name}
          </Link>
        </h3>
        <p className={styles.cardMeta}>
          <PrivacyBadge privacy={group.privacy} />
          <span>
            <UsersIcon aria-hidden="true" />
            {plural(group.member_count, "membre", "membres")}
          </span>
          {group.my_role && group.my_role !== "member" && <span className={styles.role}>{roleLabel(group.my_role)}</span>}
        </p>
        {group.description && <p className={styles.cardText}>{group.description}</p>}
        <div className={styles.cardActions}>
          <JoinButton group={group} size="sm" block />
        </div>
      </div>
    </article>
  );
}

export function GroupCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardCover} />
      <div className={styles.cardBody}>
        <Skeleton width={56} height={56} radius="50%" style={{ marginTop: -40 }} />
        <Skeleton width="70%" height={18} />
        <Skeleton width="45%" height={12} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="100%" height={32} radius={8} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}
