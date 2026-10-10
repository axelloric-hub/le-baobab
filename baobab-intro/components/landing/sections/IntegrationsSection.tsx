import {
  AudioIcon,
  CheckCircleIcon,
  CloudIcon,
  DocumentIcon,
  LinkIcon,
  SchoolIcon,
  SlidesIcon,
  VideoIcon,
  ContainerIcon,
  DatabaseIcon,
  EditorIcon,
  HubIcon,
  MergeIcon,
  PhoneIcon,
  TerminalIcon,
  CodeBracesIcon,
} from "../icons";
import { INTEGRATIONS, SECTION_IDS, type IntegrationIcon } from "../sections-content";
import { PendingButton, SectionHeading } from "./SectionHeading";
import styles from "./Sections.module.css";

const ICONS: Record<IntegrationIcon, typeof CloudIcon> = {
  terminal: TerminalIcon,
  merge: MergeIcon,
  editor: EditorIcon,
  container: ContainerIcon,
  hub: HubIcon,
  cloud: CloudIcon,
  code: CodeBracesIcon,
  phone: PhoneIcon,
  database: DatabaseIcon,
  document: DocumentIcon,
  video: VideoIcon,
  audio: AudioIcon,
  slides: SlidesIcon,
  link: LinkIcon,
  quiz: CheckCircleIcon,
  school: SchoolIcon,
};

export function IntegrationsSection() {
  const headingId = `${SECTION_IDS.integrations}-titre`;
  return (
    <section id={SECTION_IDS.integrations} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.container}>
        <SectionHeading id={headingId} eyebrow={INTEGRATIONS.eyebrow} title={INTEGRATIONS.title} lead={INTEGRATIONS.lead} />
        <ul className={`${styles.chipCloud} ${styles.reveal}`}>
          {INTEGRATIONS.items.map((item, index) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.name} className={styles.toolChip} data-tone={index % 3 === 1 ? "brown" : "blue"}>
                <Icon aria-hidden="true" />
                {item.name}
              </li>
            );
          })}
        </ul>
        <div className={styles.centerAction}>
          <PendingButton className={styles.darkButton}>{INTEGRATIONS.ctaLabel}</PendingButton>
        </div>
      </div>
    </section>
  );
}
