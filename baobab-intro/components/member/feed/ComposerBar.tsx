"use client";

import { useMe } from "@/features/me/me";
import { currentUser } from "@/lib/auth/session";
import { useCreation, type ComposerTool } from "../shell/creation-context";
import { Avatar } from "../ui/Avatar";
import { CodeIcon, ImageIcon, LinkIcon, PollIcon, ProjectIcon } from "../ui/icons";
import styles from "./Feed.module.css";

const TOOLS: Array<{ tool: ComposerTool; label: string; Icon: typeof ImageIcon; tone: string }> = [
  { tool: "media", label: "Photo ou vidéo", Icon: ImageIcon, tone: "blue" },
  { tool: "code", label: "Code", Icon: CodeIcon, tone: "brown" },
  { tool: "poll", label: "Sondage", Icon: PollIcon, tone: "amber" },
  { tool: "project", label: "Projet", Icon: ProjectIcon, tone: "green" },
  { tool: "link", label: "Lien", Icon: LinkIcon, tone: "blue" },
];

/** Point d'entrée de la publication en haut du fil (motif familier Facebook / LinkedIn). */
export function ComposerBar() {
  const { openPost } = useCreation();
  const me = useMe();
  const name = me.data?.display_name || me.data?.username || currentUser()?.username || "";
  const first = name.split(/\s+/)[0];
  return (
    <section className={styles.composerBar} aria-label="Créer une publication">
      <div className={styles.composerRow}>
        <Avatar name={name || "?"} src={me.data?.avatar_url} size={44} />
        <button type="button" className={styles.composerPrompt} onClick={() => openPost()} aria-haspopup="dialog">
          {first ? `Quoi de neuf, ${first} ? Partagez une idée, du code, un projet…` : "Partagez une idée, du code, un projet…"}
        </button>
      </div>
      <div className={styles.composerTools}>
        {TOOLS.map(({ tool, label, Icon, tone }) => (
          <button key={tool} type="button" className={styles.tool} data-tone={tone} onClick={() => openPost(tool)} aria-haspopup="dialog">
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
