"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/pages/shared/CodeBlock";
import { readCode, readLink, readProject } from "@/features/social/payload";
import { useVote } from "@/features/social/hooks";
import type { Post } from "@/features/social/types";
import { plural, relativeTime } from "@/lib/format";
import { cx } from "../ui/cx";
import { CheckIcon, CodeIcon, ExternalIcon, LinkIcon, ProjectIcon } from "../ui/icons";
import ui from "../ui/ui.module.css";
import styles from "./Post.module.css";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LinkCard({ url }: { url: string }) {
  return (
    <a href={url} className={styles.linkCard} target="_blank" rel="noopener noreferrer nofollow ugc">
      <span className={styles.linkIcon} aria-hidden="true">
        <LinkIcon />
      </span>
      <span className={styles.linkText}>
        <span className={styles.linkHost}>{hostOf(url)}</span>
        <span className={styles.linkUrl}>{url}</span>
      </span>
      <ExternalIcon aria-hidden="true" />
    </a>
  );
}

function ProjectCard({ post }: { post: Post }) {
  const project = readProject(post.payload);
  if (!project) return null;
  return (
    <div className={styles.project}>
      <div className={styles.projectHead}>
        <span className={styles.projectIcon} aria-hidden="true">
          {post.kind === "repository" ? <CodeIcon /> : <ProjectIcon />}
        </span>
        <p className={styles.projectName}>{project.name}</p>
      </div>
      {project.description && <p className={styles.projectDesc}>{project.description}</p>}
      {project.technologies && project.technologies.length > 0 && (
        <ul className={styles.techs} aria-label="Technologies">
          {project.technologies.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>
      )}
      {(project.url || project.repository_url) && (
        <div className={styles.projectLinks}>
          {project.repository_url && (
            <a href={project.repository_url} className={styles.projectLink} target="_blank" rel="noopener noreferrer nofollow ugc">
              <CodeIcon aria-hidden="true" />
              Code source
            </a>
          )}
          {project.url && (
            <a href={project.url} className={styles.projectLink} target="_blank" rel="noopener noreferrer nofollow ugc">
              <ExternalIcon aria-hidden="true" />
              Voir le projet
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Poll({ post }: { post: Post }) {
  const poll = post.poll!;
  const vote = useVote(post);
  const [picked, setPicked] = useState<string[]>([]);
  const voted = poll.my_votes.length > 0;
  const showResults = voted || poll.closed;
  const total = poll.total_votes;

  const percent = (votes: number) => (total > 0 ? Math.round((votes / total) * 100) : 0);
  const submit = (options: string[]) => options.length > 0 && vote.mutate(options);

  const ending = poll.closed ? "Sondage terminé" : poll.closes_at ? `Se termine ${relativeTime(poll.closes_at)}` : null;

  return (
    <fieldset className={styles.poll} aria-describedby={`poll-${post.id}`}>
      <legend className={styles.pollQuestion}>{poll.question}</legend>
      <ul className={styles.pollOptions}>
        {poll.options.map((option) => {
          const mine = poll.my_votes.includes(option.id);
          const chosen = showResults ? mine : picked.includes(option.id);
          const content = (
            <>
              {showResults && <span className={styles.pollFill} style={{ width: `${percent(option.votes)}%` }} aria-hidden="true" />}
              {!showResults || mine ? (
                <span className={styles.pollCheck} data-multiple={poll.allows_multiple || undefined} aria-hidden="true">
                  {chosen && <CheckIcon />}
                </span>
              ) : null}
              <span className={styles.pollLabel}>{option.label}</span>
              {showResults && <span className={styles.pollPercent}>{percent(option.votes)}&nbsp;%</span>}
            </>
          );
          return (
            <li key={option.id}>
              {showResults ? (
                <div
                  className={styles.pollOption}
                  data-chosen={mine || undefined}
                  aria-label={`${option.label} : ${percent(option.votes)} %, ${plural(option.votes, "vote", "votes")}${mine ? ", votre choix" : ""}`}
                >
                  {content}
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.pollOption}
                  data-chosen={chosen || undefined}
                  role={poll.allows_multiple ? "checkbox" : undefined}
                  aria-checked={poll.allows_multiple ? chosen : undefined}
                  disabled={vote.isPending}
                  onClick={() =>
                    poll.allows_multiple
                      ? setPicked((list) => (list.includes(option.id) ? list.filter((id) => id !== option.id) : [...list, option.id]))
                      : submit([option.id])
                  }
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.pollFooter} id={`poll-${post.id}`}>
        <span>
          {plural(total, "vote", "votes")}
          {ending && ` · ${ending}`}
          {poll.is_anonymous && " · Vote anonyme"}
        </span>
        {!showResults && poll.allows_multiple && (
          <button type="button" className={cx(ui.button, ui.blue, ui.small)} disabled={picked.length === 0 || vote.isPending} onClick={() => submit(picked)}>
            Voter
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** Contenu propre au type de publication (code, lien, projet, dépôt, sondage). */
export function PostAttachment({ post }: { post: Post }) {
  switch (post.kind) {
    case "code": {
      const code = readCode(post.payload);
      return code ? (
        <div className={styles.codeWrap}>
          <CodeBlock code={code.code} filename={code.filename} language={code.language || undefined} copyable />
        </div>
      ) : null;
    }
    case "link": {
      const link = readLink(post.payload);
      return link ? <LinkCard url={link.url} /> : null;
    }
    case "project":
    case "repository":
    case "portfolio":
      return <ProjectCard post={post} />;
    case "poll":
      return post.poll ? <Poll post={post} /> : null;
    default:
      return null;
  }
}
