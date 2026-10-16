"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { Course, Progress } from "@/features/learn/types";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { ClockIcon, ListIcon, UsersIcon } from "../ui/icons";
import { Pill } from "../ui/Pill";
import { Skeleton } from "../ui/States";
import { duration, LEVELS } from "./labels";
import styles from "./Learn.module.css";

/** Deux teintes de la charte choisies à partir du titre : chaque cours garde toujours la même couverture. */
const PAIRS: Array<[string, string]> = [
  ["#5a2410", "#1f56d6"],
  ["#6f2c0e", "#2563eb"],
  ["#8a3a12", "#5a2410"],
  ["#1f56d6", "#6f2c0e"],
  ["#9a4a1f", "#3479ee"],
  ["#2a140a", "#8a3a12"],
];

export function coverStyle(seed: string): CSSProperties {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [c1, c2] = PAIRS[hash % PAIRS.length];
  return { ["--c1" as string]: c1, ["--c2" as string]: c2 };
}

export function priceLabel(course: Pick<Course, "is_free" | "price_minor" | "currency">) {
  return course.is_free || !course.price_minor ? "Gratuit" : formatMoney(course.price_minor, course.currency);
}

export function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  const percent = Math.round(progress.percent);
  return (
    <span className={styles.progressRow}>
      <span className={styles.progress} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${percent}%` }} />
      </span>
      {percent}&nbsp;%
    </span>
  );
}

export function CourseCard({ course, progress, showStatus }: { course: Course; progress?: Progress; showStatus?: boolean }) {
  const free = course.is_free || !course.price_minor;
  const teacher = course.teachers[0];
  return (
    <article className={styles.card}>
      <div className={styles.cover} style={coverStyle(course.title)} aria-hidden="true">
        <span className={styles.coverLevel}>{LEVELS[course.level]}</span>
        <span className={styles.coverPrice} data-free={free || undefined}>
          {priceLabel(course)}
        </span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link href={ROUTES.course(course.id)} className={styles.link}>
            {course.title}
          </Link>
        </h3>
        <p className={styles.meta}>
          <span>{course.classroom_title}</span>
          {course.stats.chapters > 0 && (
            <span>
              <ListIcon aria-hidden="true" />
              {course.stats.chapters} chapitre{course.stats.chapters > 1 ? "s" : ""}
            </span>
          )}
          {course.stats.minutes > 0 && (
            <span>
              <ClockIcon aria-hidden="true" />
              {duration(course.stats.minutes)}
            </span>
          )}
        </p>
        {course.description && !progress && <p className={styles.excerpt}>{course.description}</p>}
        {progress && <ProgressBar progress={progress} label={`Progression : ${course.title}`} />}
        <div className={styles.foot}>
          {teacher && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <UsersIcon width={15} height={15} aria-hidden="true" />
              {teacher.display_name || teacher.username}
              {course.teachers.length > 1 && ` +${course.teachers.length - 1}`}
            </span>
          )}
          {showStatus && course.status !== "published" && (
            <span style={{ marginLeft: "auto" }}>
              <Pill tone="amber">Brouillon</Pill>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton height={112} radius={0} />
      <div className={styles.body}>
        <Skeleton width="80%" height={18} />
        <Skeleton width="50%" height={12} />
        <Skeleton width="100%" height={12} />
      </div>
    </div>
  );
}
