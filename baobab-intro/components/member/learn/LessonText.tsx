import { Fragment, type ReactNode } from "react";
import { CodeBlock } from "@/components/pages/shared/CodeBlock";
import styles from "./Learn.module.css";

/**
 * Texte d'un chapitre, écrit par l'enseignant dans un format simple :
 *   ## Titre, ### Sous-titre · - liste · 1. liste numérotée · ```langage … ``` · `code` · **gras** · _italique_ · liens https://…
 * Aucun HTML n'est interprété : tout passe par React (pas d'injection possible).
 */
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|(?<![\w])_([^_]+)_(?![\w])|(https:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={`${key}-t${i++}`}>{text.slice(last, at)}</Fragment>);
    const [whole, code, strong, em, url] = m;
    if (code) out.push(<code key={`${key}-c${i++}`}>{code}</code>);
    else if (strong) out.push(<strong key={`${key}-s${i++}`}>{strong}</strong>);
    else if (em) out.push(<em key={`${key}-e${i++}`}>{em}</em>);
    else if (url)
      out.push(
        <a key={`${key}-a${i++}`} href={url} target="_blank" rel="noreferrer noopener">
          {url.replace(/^https:\/\/(www\.)?/, "")}
        </a>,
      );
    last = at + whole.length;
  }
  if (last < text.length) out.push(<Fragment key={`${key}-t${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}

export function LessonText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i += 1;
      nodes.push(<CodeBlock key={k++} code={code.join("\n")} language={fence[1] || undefined} copyable compact />);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      nodes.push(<Tag key={k++}>{inline(heading[2], `h${k}`)}</Tag>);
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) items.push(lines[i++].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
      const List = ordered ? "ol" : "ul";
      nodes.push(
        <List key={k++}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `l${k}-${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) paragraph.push(lines[i++]);
    nodes.push(
      <p key={k++}>
        {paragraph.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `p${k}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={styles.prose}>{nodes}</div>;
}
