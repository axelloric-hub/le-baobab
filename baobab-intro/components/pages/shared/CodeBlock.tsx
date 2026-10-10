import { highlightLine } from "./highlight";
import { CopyButton } from "./CopyButton";
import styles from "./Pages.module.css";

interface CodeBlockProps {
  code: string;
  filename?: string;
  language?: string;
  /** Bouton « copier » (désactivé pour les petits extraits décoratifs). */
  copyable?: boolean;
  compact?: boolean;
  /** Nom accessible du bloc (sinon : nom du fichier). */
  label?: string;
}

/** Bloc de code sombre, cohérent avec le terminal de la page d'accueil. */
export function CodeBlock({ code, filename, language, copyable = false, compact = false, label }: CodeBlockProps) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <figure className={styles.code} data-compact={compact || undefined} aria-label={label ?? filename ?? "Extrait de code"}>
      {(filename || language || copyable) && (
        <figcaption className={styles.codeBar}>
          <span className={styles.codeDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {filename && <span className={styles.codeFile}>{filename}</span>}
          <span className={styles.codeMeta}>
            {language && <span className={styles.codeLang}>{language}</span>}
            {copyable && <CopyButton text={code} label="Copier le code" className={styles.codeCopy} iconOnly />}
          </span>
        </figcaption>
      )}
      <pre className={styles.codeBody} tabIndex={0}>
        <code>
          {lines.map((line, lineIndex) => (
            <span key={lineIndex} className={styles.codeLine}>
              {line === ""
                ? " "
                : highlightLine(line).map((token, tokenIndex) =>
                    token.tone === "plain" ? (
                      token.text
                    ) : (
                      <span key={tokenIndex} data-tone={token.tone}>
                        {token.text}
                      </span>
                    ),
                  )}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
