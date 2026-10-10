import { LightbulbIcon, SparklesIcon } from "../icons";
import { COPILOT, SECTION_IDS } from "../sections-content";
import common from "./Sections.module.css";
import styles from "./Workspace.module.css";

export function CopilotSection() {
  const headingId = `${SECTION_IDS.copilot}-titre`;
  const { chat } = COPILOT;
  return (
    <section id={SECTION_IDS.copilot} className={common.section} aria-labelledby={headingId}>
      <div className={common.container}>
        <div className={`${styles.copilot} ${common.reveal}`}>
          <div className={styles.copilotCopy}>
            <p className={styles.aiBadge}>
              <SparklesIcon aria-hidden="true" />
              {COPILOT.badge}
            </p>
            <h2 id={headingId} className={`${common.title} ${styles.copilotTitle}`}>
              {COPILOT.title}
            </h2>
            <p className={styles.copilotText}>{COPILOT.text}</p>
            <ul className={styles.highlightGrid}>
              {COPILOT.highlights.map((highlight) => (
                <li key={highlight.title} className={styles.highlight}>
                  <span className={styles.highlightTitle} data-tone={highlight.tone}>
                    {highlight.title}
                  </span>
                  <span className={styles.highlightText}>{highlight.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <figure className={styles.chat} aria-label={`Exemple d'échange avec ${chat.assistant} (aperçu illustratif d'une fonctionnalité à venir)`}>
            <div className={styles.chatHeader}>
              <span className={styles.chatAvatar} aria-hidden="true">
                <SparklesIcon />
              </span>
              <span className={styles.chatWho}>
                <span className={styles.chatName}>{chat.assistant}</span>
                <span className={styles.chatMode}>{chat.mode}</span>
              </span>
              <span className={styles.chatStatus}>{chat.status}</span>
            </div>
            <div className={styles.chatQuestion}>
              <span className={styles.chatLabel}>{chat.questionLabel}</span>
              <p>« {chat.question} »</p>
            </div>
            <div className={styles.chatAnswer}>
              <span className={styles.chatAnswerLabel}>
                <LightbulbIcon aria-hidden="true" />
                {chat.answerLabel}
              </span>
              <p>
                {chat.answerBefore}
                <strong>{chat.answerStrong}</strong>
                {chat.answerAfter}
              </p>
              <code className={styles.chatCommand}>{chat.command}</code>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
