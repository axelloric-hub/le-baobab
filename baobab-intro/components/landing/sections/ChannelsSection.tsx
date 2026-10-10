import { ArrowRightIcon, BriefcaseIcon, BuildingIcon, CodeBracesIcon, ForumIcon, SchoolIcon, ServerIcon, ShopIcon } from "../icons";
import { CHANNELS, SECTION_IDS, type ChannelIcon } from "../sections-content";
import { SectionHeading } from "./SectionHeading";
import styles from "./Sections.module.css";

const ICONS: Record<ChannelIcon, typeof ForumIcon> = {
  code: CodeBracesIcon,
  forum: ForumIcon,
  work: BriefcaseIcon,
  school: SchoolIcon,
  server: ServerIcon,
  building: BuildingIcon,
  shop: ShopIcon,
};

export function ChannelsSection() {
  const headingId = `${SECTION_IDS.platform}-titre`;
  return (
    <section id={SECTION_IDS.platform} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.container}>
        <SectionHeading id={headingId} eyebrow={CHANNELS.eyebrow} title={CHANNELS.title} lead={CHANNELS.lead} />
        <ul className={styles.channelGrid}>
          {CHANNELS.items.map((channel) => {
            const Icon = ICONS[channel.icon];
            return (
              <li key={channel.title} className={`${styles.channelCard} ${styles.reveal}`}>
                <span className={styles.channelIcon} data-tone={channel.tone} aria-hidden="true">
                  <Icon />
                </span>
                <h3 className={styles.channelTitle}>{channel.title}</h3>
                <p className={styles.channelText}>{channel.text}</p>
                {/* Pas encore de page dédiée : libellé d'action sans lien. */}
                <span className={styles.channelAction} aria-disabled="true" title="Bientôt disponible">
                  {channel.action}
                  <ArrowRightIcon />
                  <span className={styles.soonTag}>Bientôt</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
