"use client";

import Link from "next/link";
import type { ShowcaseProject } from "@/features/showcase/types";
import { ROUTES } from "@/lib/routes";
import { coverStyle } from "../learn/CourseCard";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { CodeIcon, ExternalIcon, StarIcon } from "../ui/icons";
import { Skeleton } from "../ui/States";
import ui from "../ui/ui.module.css";
import styles from "./Showcase.module.css";

export const LINK_LABELS: Record<string, string> = { demo: "Démo", repository: "Code", article: "Article", other: "Lien" };

const monogram = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Couverture : la première image réelle du projet, sinon le motif de la charte (teinte stable par titre). */
export function ProjectCover({ project, className }: { project: Pick<ShowcaseProject, "title" | "media">; className?: string }) {
  const image = project.media.find((m) => m.kind === "image");
  return (
    <div className={cx(styles.cover, className)} style={coverStyle(project.title)} aria-hidden="true">
      {image ? <img src={image.url} alt="" loading="lazy" /> : <span className={styles.coverMonogram}>{monogram(project.title)}</span>}
    </div>
  );
}

export function ProjectCard({ project, showOwner = true }: { project: ShowcaseProject; showOwner?: boolean }) {
  const shown = project.technologies.slice(0, 4);
  const rest = project.technologies.length - shown.length;
  const external = project.links.filter((l) => l.kind === "demo" || l.kind === "repository").slice(0, 2);
  return (
    <article className={styles.card}>
      <div style={{ position: "relative" }}>
        <ProjectCover project={project} />
        {project.is_featured && (
          <span className={styles.badge}>
            <StarIcon aria-hidden="true" />
            Épinglé
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link href={ROUTES.showcaseProject(project.id)} className={styles.link}>
            {project.title}
          </Link>
        </h3>
        {project.description && <p className={styles.excerpt}>{project.description}</p>}
        {shown.length > 0 && (
          <ul className={styles.techs} aria-label="Technologies">
            {shown.map((t) => (
              <li key={t.slug} className={styles.tech}>
                {t.name}
              </li>
            ))}
            {rest > 0 && <li className={styles.tech}>+{rest}</li>}
          </ul>
        )}
        <div className={styles.foot}>
          {showOwner ? (
            <>
              <Avatar name={project.owner.display_name || project.owner.username} src={project.owner.avatar_url} size={24} />
              <span>{project.owner.display_name || project.owner.username}</span>
            </>
          ) : (
            project.role && <span>{project.role}</span>
          )}
          {external.length > 0 && (
            <span className={styles.footLinks}>
              {external.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={cx(ui.iconButton)}
                  aria-label={`${LINK_LABELS[l.kind]} de ${project.title} (nouvel onglet)`}
                  title={LINK_LABELS[l.kind]}
                >
                  {l.kind === "repository" ? <CodeIcon /> : <ExternalIcon />}
                </a>
              ))}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div style={{ aspectRatio: "16 / 9" }}>
        <Skeleton height="100%" radius={0} />
      </div>
      <div className={styles.body}>
        <Skeleton width="75%" height={18} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="45%" height={12} />
      </div>
    </div>
  );
}
