import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTES } from "@/lib/routes";
import { CodeBlock } from "@/components/pages/shared/CodeBlock";
import styles from "./Post.module.css";

/** Mêmes règles que le backend (apps/social/services.py : HASHTAG_RE, MENTION_RE). */
export const TAG_RE = /^[A-Za-z0-9_À-ɏ]{2,50}$/;
const TOKEN_RE =
  /(?<![\w#])#([A-Za-z0-9_À-ɏ]{2,50})|(?<![\w@])@([a-z0-9][a-z0-9_.]{2,29})|\b(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|`([^`\n]+)`/g;

/** Découpe une ligne de texte en hashtags (liens), mentions, adresses web et `code`. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${keyBase}-${index}`;
    const [whole, tag, mention, url, code] = match;
    if (tag) {
      out.push(
        <Link key={key} href={ROUTES.hashtag(tag)} className={styles.tag} onClick={(e) => e.stopPropagation()}>
          #{tag}
        </Link>,
      );
    } else if (mention) {
      // Les pages de profil arrivent au lot 2 : la mention est mise en valeur, sans lien.
      out.push(
        <span key={key} className={styles.mention}>
          @{mention}
        </span>,
      );
    } else if (url) {
      let label = url.replace(/^https?:\/\/(www\.)?/, "");
      if (label.length > 48) label = `${label.slice(0, 46)}…`;
      out.push(
        <a key={key} href={url} className={styles.url} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={(e) => e.stopPropagation()}>
          {label}
        </a>,
      );
    } else if (code) {
      out.push(
        <code key={key} className={styles.inlineCode}>
          {code}
        </code>,
      );
    } else {
      out.push(whole);
    }
    last = index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const FENCE_RE = /```([\w+#.-]*)\n([\s\S]*?)```/g;

/**
 * Texte d'une publication ou d'un commentaire : paragraphes, retours à la ligne,
 * blocs ```code``` (coloration du site), #hashtags, @mentions et liens.
 * Aucun HTML n'est interprété : tout passe par React (pas d'injection possible).
 */
export function RichBody({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let last = 0;
  const pushText = (chunk: string, at: number) => {
    chunk
      .split(/\n{2,}/)
      .filter((p) => p.trim())
      .forEach((paragraph, i) => {
        const lines = paragraph.replace(/^\n+|\n+$/g, "").split("\n");
        blocks.push(
          <p key={`p-${at}-${i}`}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line, `${at}-${i}-${j}`)}
              </span>
            ))}
          </p>,
        );
      });
  };
  for (const match of text.matchAll(FENCE_RE)) {
    const index = match.index ?? 0;
    pushText(text.slice(last, index), last);
    blocks.push(
      <div key={`c-${index}`} className={styles.codeWrap}>
        <CodeBlock code={match[2]} language={match[1] || undefined} copyable compact />
      </div>,
    );
    last = index + match[0].length;
  }
  pushText(text.slice(last), last);
  return <div className={className}>{blocks}</div>;
}
