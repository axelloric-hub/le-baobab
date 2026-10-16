"use client";

import { CodeBlock } from "@/components/pages/shared/CodeBlock";
import type { ContentBlock } from "@/features/learn/types";
import { AudioIcon, ExternalIcon, FileIcon, LinkIcon, RepoIcon, StarIcon, VideoIcon } from "../ui/icons";
import { LessonText } from "./LessonText";
import { QuizRunner } from "./QuizRunner";
import styles from "./Learn.module.css";

const str = (v: unknown) => (typeof v === "string" ? v : "");

function FileCard({ href, title, hint, Icon = FileIcon }: { href: string; title: string; hint: string; Icon?: typeof FileIcon }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={styles.fileCard}>
      <span className={styles.fileIcon}>
        <Icon />
      </span>
      <span className={styles.fileText}>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <ExternalIcon width={18} height={18} aria-hidden="true" />
    </a>
  );
}

/** Lecteur YouTube : adresse d'intégration reconstruite par le serveur (jamais celle collée par l'enseignant). */
function YouTube({ block }: { block: ContentBlock }) {
  const embed = str(block.payload.embed_url);
  if (!embed.startsWith("https://www.youtube-nocookie.com/") && !embed.startsWith("https://www.youtube.com/embed/")) {
    return block.url ? <FileCard href={block.url} title={block.title || "Vidéo"} hint="Ouvrir la vidéo" Icon={VideoIcon} /> : null;
  }
  return (
    <div className={styles.embed}>
      <iframe
        src={embed}
        title={block.title || str(block.payload.title) || "Vidéo du cours"}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

function Repository({ block }: { block: ContentBlock }) {
  const repo = (block.payload.repository ?? {}) as Record<string, unknown>;
  const name = str(repo.full_name) || block.url.replace("https://github.com/", "");
  const stars = typeof repo.stars === "number" ? repo.stars : null;
  const hint = [str(repo.description), str(repo.language), stars !== null ? `${stars} ★` : ""].filter(Boolean).join(" · ") || "Dépôt GitHub";
  return <FileCard href={block.url} title={name} hint={hint} Icon={stars !== null ? StarIcon : RepoIcon} />;
}

export function Block({ block }: { block: ContentBlock }) {
  const heading = block.title && block.kind !== "quiz" ? <h3 className={styles.blockTitle}>{block.title}</h3> : null;
  switch (block.kind) {
    case "text":
      return (
        <div>
          {heading}
          <LessonText text={block.body} />
        </div>
      );
    case "code":
      return (
        <div>
          {heading}
          <CodeBlock code={block.body} language={str(block.payload.language) || undefined} filename={str(block.payload.filename) || undefined} copyable />
        </div>
      );
    case "image":
      return block.file_url || block.url ? (
        <figure style={{ margin: 0 }}>
          <div className={styles.media} style={{ background: "transparent" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée */}
            <img src={block.file_url ?? block.url} alt={block.title || ""} loading="lazy" />
          </div>
          {block.title && <figcaption className={styles.blockTitle} style={{ marginTop: 8, fontWeight: 500, fontSize: 14 }}>{block.title}</figcaption>}
        </figure>
      ) : null;
    case "video":
      if (block.file_url) {
        return (
          <div>
            {heading}
            <div className={styles.media}>
              <video src={block.file_url} controls preload="metadata" playsInline />
            </div>
          </div>
        );
      }
      return (
        <div>
          {heading}
          <YouTube block={block} />
        </div>
      );
    case "embed":
      return (
        <div>
          {heading}
          <YouTube block={block} />
        </div>
      );
    case "audio":
      return block.file_url ? (
        <div>
          {heading ?? (
            <h3 className={styles.blockTitle}>
              <AudioIcon width={16} height={16} style={{ verticalAlign: "-3px" }} /> Audio
            </h3>
          )}
          <audio src={block.file_url} controls preload="metadata" style={{ width: "100%" }} />
        </div>
      ) : null;
    case "pdf":
    case "document":
    case "presentation":
    case "notebook": {
      const href = block.file_url ?? block.url;
      return href ? <FileCard href={href} title={block.title || "Document du cours"} hint={block.kind === "pdf" ? "PDF · s'ouvre dans un nouvel onglet" : "Document · s'ouvre dans un nouvel onglet"} /> : null;
    }
    case "link":
      return <FileCard href={block.url} title={block.title || str(block.payload.title) || block.url.replace(/^https:\/\//, "")} hint={block.url.replace(/^https:\/\/(www\.)?/, "")} Icon={LinkIcon} />;
    case "repository":
      return <Repository block={block} />;
    case "quiz":
    case "exercise":
      return block.ref_id ? <QuizRunner quizId={block.ref_id} title={block.title} /> : null;
    default:
      return null;
  }
}
