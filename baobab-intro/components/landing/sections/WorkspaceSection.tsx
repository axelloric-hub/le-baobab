import { CheckCircleIcon, ForumIcon, BriefcaseIcon, LockIcon, SchoolIcon } from "../icons";
import { SECTION_IDS, WORKSPACE, type WorkspacePreview, type WorkspaceTab } from "../sections-content";
import { PendingButton, SectionHeading } from "./SectionHeading";
import { WorkspaceTabs } from "./WorkspaceTabs";
import common from "./Sections.module.css";
import styles from "./Workspace.module.css";

function Preview({ preview }: { preview: WorkspacePreview }) {
  if (preview.kind === "terminal") {
    return (
      <figure className={styles.terminal}>
        <figcaption className={styles.terminalBar}>
          <span className={styles.terminalDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className={styles.terminalFile}>{preview.file}</span>
          <span className={styles.terminalStatus}>{preview.status}</span>
        </figcaption>
        <pre className={styles.terminalCode}>
          <code>
            {preview.lines.map((line, index) => (
              <span key={index} className={styles.codeLine} data-tone={line.tone}>
                {line.text || " "}
              </span>
            ))}
          </code>
        </pre>
      </figure>
    );
  }

  if (preview.kind === "thread") {
    return (
      <div className={styles.thread}>
        <div className={styles.threadHeader}>
          <span className={styles.threadIcon} aria-hidden="true">
            <ForumIcon />
          </span>
          {preview.channel}
        </div>
        <div className={styles.bubble}>
          <span className={styles.bubbleAuthor}>{preview.question.author}</span>
          <p>{preview.question.text}</p>
        </div>
        <div className={`${styles.bubble} ${styles.bubbleAnswer}`}>
          <span className={styles.bubbleAuthor}>{preview.answer.author}</span>
          <p>{preview.answer.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mission}>
      <div className={styles.missionHeader}>
        <span className={styles.threadIcon} aria-hidden="true">
          {preview.icon === "school" ? <SchoolIcon /> : <BriefcaseIcon />}
        </span>
        <span className={styles.missionTitle}>{preview.title}</span>
      </div>
      <ul className={styles.missionTags} aria-label="Étiquettes">
        {preview.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div className={styles.missionRow}>
        <LockIcon aria-hidden="true" />
        {preview.budget}
      </div>
      <div className={styles.missionRow}>{preview.payout}</div>
      <p className={styles.missionNote}>{preview.note}</p>
    </div>
  );
}

function Panel({ tab }: { tab: WorkspaceTab }) {
  return (
    <div className={styles.panelGrid}>
      <div className={styles.panelCopy}>
        <p className={styles.panelEyebrow}>{tab.eyebrow}</p>
        <h3 className={styles.panelTitle}>{tab.title}</h3>
        <p className={styles.panelText}>{tab.text}</p>
        <ul className={styles.checkList}>
          {tab.bullets.map((bullet) => (
            <li key={bullet}>
              <CheckCircleIcon aria-hidden="true" />
              {bullet}
            </li>
          ))}
        </ul>
        <PendingButton className={common.darkButton}>{tab.ctaLabel}</PendingButton>
      </div>
      <div className={styles.panelPreview}>
        <Preview preview={tab.preview} />
        <p className={styles.previewNotice}>{WORKSPACE.previewNotice}</p>
      </div>
    </div>
  );
}

export function WorkspaceSection() {
  const headingId = `${SECTION_IDS.workspace}-titre`;
  return (
    <section id={SECTION_IDS.workspace} className={common.section} aria-labelledby={headingId}>
      <div className={common.container}>
        <SectionHeading id={headingId} title={WORKSPACE.title} lead={WORKSPACE.lead} />
        <div className={common.reveal}>
          <WorkspaceTabs
            labels={WORKSPACE.tabs.map((tab) => tab.label)}
            panels={WORKSPACE.tabs.map((tab) => (
              <Panel key={tab.id} tab={tab} />
            ))}
          />
        </div>
      </div>
    </section>
  );
}
