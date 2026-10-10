import Link from "next/link";
import { ArrowRightIcon, CommentIcon, ExternalIcon, HubIcon } from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import shared from "../shared/Pages.module.css";
import { RichText } from "../shared/RichText";
import { DocsSearch } from "./DocsClient";
import { DOCS_ICONS, DocsLayout } from "./DocsLayout";
import { DOCS_ACCOUNT_HREF, DOCS_HOME, DOCS_PILLARS, DOCS_SOURCE_URL, DOCS_UI, DOCS_VERSION } from "./docs-content";
import styles from "./Docs.module.css";

function QuickHelp() {
  return (
    <>
      <div className={styles.railCard}>
        <p className={styles.railCardTitle}>
          <CommentIcon aria-hidden="true" />
          {DOCS_HOME.quick.title}
        </p>
        <p className={styles.railCardText}>{DOCS_HOME.quick.text}</p>
        <PendingButton className={styles.railCardAction}>
          {DOCS_HOME.quick.action}
          <ExternalIcon aria-hidden="true" />
        </PendingButton>
      </div>
      <p className={styles.railNote}>
        {DOCS_UI.sourceNote}{" "}
        <a href={DOCS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {DOCS_UI.editOnGitHub}
          <span className="bb-visually-hidden"> (nouvel onglet)</span>
        </a>
      </p>
    </>
  );
}

export function DocsHome() {
  return (
    <DocsLayout currentPath="/docs" toc={DOCS_HOME.toc} aside={<QuickHelp />}>
      <div id="vue-d-ensemble" className={styles.anchor}>
        <div className={styles.topBar}>
          <nav className={shared.breadcrumb} aria-label="Fil d'Ariane">
            <ol>
              <li>
                <span>Docs</span>
              </li>
              <li>
                <span aria-current="page">{DOCS_HOME.breadcrumb}</span>
              </li>
            </ol>
          </nav>
          <span className={styles.revision}>{DOCS_VERSION}</span>
        </div>
        <DocsSearch />
      </div>

      <header className={styles.hero}>
        <p className={styles.heroBadge}>
          <span aria-hidden="true" />
          {DOCS_HOME.badge}
        </p>
        <h1 className={styles.heroTitle}>{DOCS_HOME.title}</h1>
        <p className={styles.heroLead}>
          <RichText text={DOCS_HOME.lead} />
        </p>
      </header>

      <section id="parcours-developpeur" className={styles.anchor} aria-labelledby="cycle-titre">
        <div className={styles.cycleHead}>
          <h2 id="cycle-titre" className={styles.cycleTitle}>
            <HubIcon aria-hidden="true" />
            {DOCS_HOME.cycle.title}
          </h2>
          <span>{DOCS_HOME.cycle.caption}</span>
        </div>
        <ol className={styles.cycle}>
          {DOCS_HOME.cycle.steps.map((step, index) => (
            <li key={step.title}>
              <span className={styles.cycleNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.cycleText}>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className={shared.illustrative}>Aperçu illustratif</p>
      </section>

      <section id="piliers" className={styles.anchor} aria-labelledby="piliers-titre">
        <div className={styles.sectionHead}>
          <h2 id="piliers-titre" className={styles.sectionTitle}>
            {DOCS_HOME.pillars.title}
          </h2>
          <p className={styles.sectionLead}>{DOCS_HOME.pillars.lead}</p>
        </div>
        <ul className={styles.pillars}>
          {DOCS_PILLARS.map((pillar, index) => {
            const Icon = DOCS_ICONS[pillar.icon];
            return (
              <li key={pillar.id} id={pillar.id} className={styles.pillar} data-wide={index === DOCS_PILLARS.length - 1 || undefined}>
                <div className={styles.pillarHead}>
                  <span className={styles.pillarIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <div>
                    <h3 className={styles.pillarTitle}>{pillar.title}</h3>
                    <p className={styles.pillarText}>{pillar.description}</p>
                  </div>
                </div>
                <ul className={styles.pillarLinks}>
                  {pillar.links.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        <Link href={link.href} className={styles.pillarLink}>
                          <ArrowRightIcon aria-hidden="true" />
                          {link.label}
                        </Link>
                      ) : (
                        <span className={styles.pillarLink} aria-disabled="true" title={DOCS_UI.soon}>
                          <ArrowRightIcon aria-hidden="true" />
                          {link.label}
                          <small>{DOCS_UI.soon}</small>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="aide" className={`${styles.anchor} ${styles.helpBox}`} aria-labelledby="aide-titre">
        <div>
          <h2 id="aide-titre" className={styles.helpTitle}>
            {DOCS_HOME.help.title}
          </h2>
          <p className={styles.helpText}>{DOCS_HOME.help.text}</p>
        </div>
        <div className={styles.helpActions}>
          <Link href="/#faq" className={shared.ghostButton}>
            {DOCS_HOME.help.faq}
          </Link>
          <Link href={DOCS_ACCOUNT_HREF} className={styles.helpPrimary}>
            {DOCS_HOME.help.action}
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
      </section>
    </DocsLayout>
  );
}
