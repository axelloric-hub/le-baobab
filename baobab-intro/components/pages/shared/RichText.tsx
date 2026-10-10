import { Fragment, type ReactNode } from "react";
import styles from "./Pages.module.css";

/**
 * Mise en forme légère des textes de contenu : `code`, **gras**, _italique_.
 * Évite d'écrire du HTML dans les fichiers de contenu.
 */
const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|_([^_]+)_/g;

export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(<Fragment key={key++}>{text.slice(last, index)}</Fragment>);
    const [whole, code, strong, em] = match;
    if (code) parts.push(<code key={key++} className={styles.inlineCode}>{code}</code>);
    else if (strong) parts.push(<strong key={key++}>{strong}</strong>);
    else if (em) parts.push(<em key={key++}>{em}</em>);
    last = index + whole.length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}
