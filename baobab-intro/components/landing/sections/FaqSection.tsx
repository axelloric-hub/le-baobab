import { ChevronDownIcon } from "../icons";
import { FAQ, SECTION_IDS } from "../sections-content";
import { SectionHeading } from "./SectionHeading";
import styles from "./Sections.module.css";

/**
 * FAQ en accordéon natif (<details>/<summary>) : accessible au clavier et aux
 * lecteurs d'écran sans JavaScript. L'attribut `name` partagé fait qu'une seule
 * réponse est ouverte à la fois (comme dans la maquette).
 */
export function FaqSection() {
  const headingId = `${SECTION_IDS.faq}-titre`;
  return (
    <section id={SECTION_IDS.faq} className={styles.section} aria-labelledby={headingId}>
      <div className={`${styles.container} ${styles.narrow}`}>
        <SectionHeading id={headingId} eyebrow="FAQ" title={FAQ.title} />
        <div className={`${styles.faqList} ${styles.reveal}`}>
          {FAQ.items.map((item, index) => (
            <details key={item.question} className={styles.faqItem} name="baobab-faq" open={index === 0}>
              <summary className={styles.faqQuestion}>
                <span>{item.question}</span>
                <ChevronDownIcon className={styles.faqChevron} aria-hidden="true" />
              </summary>
              <div className={styles.faqAnswer}>
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
