"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { useMyEnrollments, useMyGroups } from "@/features/me/me";
import { Avatar } from "../ui/Avatar";
import styles from "./Shell.module.css";

/** « Mes groupes » (menu latéral et panneau mobile). Rien n'est affiché sans groupe. */
export function MyGroupsSection({ limit = 5, idPrefix = "nav" }: { limit?: number; idPrefix?: string }) {
  const groups = useMyGroups(true);
  if (!groups.data || groups.data.length === 0) return null;
  return (
    <section className={styles.navSection} aria-labelledby={`${idPrefix}-groupes`}>
      <h2 id={`${idPrefix}-groupes`} className={styles.navHeading}>
        Mes groupes
      </h2>
      <ul className={styles.navMini}>
        {groups.data.slice(0, limit).map((group) => (
          <li key={group.slug}>
            <Link href={ROUTES.group(group.slug)} className={styles.navMiniItem}>
              <Avatar name={group.name} src={group.avatar_url} size={24} />
              <span>{group.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** « Mes cours » en cours, avec la progression réelle. Rien n'est affiché sans inscription. */
export function MyCoursesSection({ idPrefix = "nav" }: { idPrefix?: string }) {
  const courses = useMyEnrollments();
  if (!courses.data || courses.data.length === 0) return null;
  return (
    <section className={styles.navSection} aria-labelledby={`${idPrefix}-cours`}>
      <h2 id={`${idPrefix}-cours`} className={styles.navHeading}>
        Mes cours
      </h2>
      {courses.data.map((enrollment) => {
        const percent = Math.round(enrollment.progress.percent);
        return (
          <Link key={enrollment.course.id} href={ROUTES.course(enrollment.course.id)} className={styles.course}>
            <span className={styles.courseTitle}>{enrollment.course.title}</span>
            <span className={styles.courseMeta}>Progression&nbsp;: {percent}&nbsp;%</span>
            <span
              className={styles.progress}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progression du cours ${enrollment.course.title}`}
            >
              <span style={{ width: `${percent}%` }} />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
