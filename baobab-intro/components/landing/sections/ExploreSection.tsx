import Link from "next/link";
import { ArrowRightIcon, DocumentIcon, ForumIcon, PenIcon } from "../icons";
import { EXPLORE, SECTION_IDS, type ExploreIcon } from "../sections-content";
import { SectionHeading } from "./SectionHeading";
import styles from "./Sections.module.css";

const ICONS: Record<ExploreIcon, typeof ForumIcon> = {
  community: ForumIcon,
  blog: PenIcon,
  docs: DocumentIcon,
};

/** Accès aux pages Communauté, Blog et Docs depuis l'accueil. */
export function ExploreSection() {
  const headingId = `${SECTION_IDS.explore}-titre`;
  return (
    <section id={SECTION_IDS.explore} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.container}>
        <SectionHeading id={headingId} eyebrow={EXPLORE.eyebrow} title={EXPLORE.title} lead={EXPLORE.lead} />
        <ul className={`${styles.exploreGrid} ${styles.reveal}`}>
          {EXPLORE.cards.map((card, index) => {
            const Icon = ICONS[card.icon];
            return (
              <li key={card.href} className={`${styles.channelCard} ${styles.exploreCard}`}>
                <span className={styles.channelIcon} data-tone={index % 2 === 0 ? "brown" : "blue"} aria-hidden="true">
                  <Icon />
                </span>
                <h3 className={styles.channelTitle}>
                  <Link href={card.href} className={styles.exploreLink}>
                    {card.title}
                  </Link>
                </h3>
                <p className={styles.channelText}>{card.text}</p>
                <span className={`${styles.channelAction} ${styles.exploreAction}`} aria-hidden="true">
                  {card.action}
                  <ArrowRightIcon />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
