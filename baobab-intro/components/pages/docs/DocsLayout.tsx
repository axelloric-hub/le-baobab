import Link from "next/link";
import type { ReactNode } from "react";
import {
  BriefcaseIcon,
  BuildingIcon,
  ChevronRightIcon,
  FolderCodeIcon,
  ForumIcon,
  RocketIcon,
  SchoolIcon,
  ShieldIcon,
} from "@/components/landing/icons";
import { DocsToc } from "./DocsClient";
import { DOCS_PILLARS, DOCS_START_LINKS, DOCS_UI, DOCS_VERSION, type DocsIcon } from "./docs-content";
import styles from "./Docs.module.css";

export const DOCS_ICONS: Record<DocsIcon, typeof RocketIcon> = {
  rocket: RocketIcon,
  forum: ForumIcon,
  school: SchoolIcon,
  folder: FolderCodeIcon,
  briefcase: BriefcaseIcon,
  building: BuildingIcon,
  shield: ShieldIcon,
};

function SidebarNav({ currentPath }: { currentPath: string }) {
  const [start, ...others] = DOCS_PILLARS;
  const StartIcon = DOCS_ICONS[start.icon];
  return (
    <nav className={styles.sidebarNav} aria-label={DOCS_UI.sidebarTitle}>
      <div className={styles.sidebarHead}>
        <span>{DOCS_UI.sidebarTitle}</span>
        <span className={styles.version}>{DOCS_VERSION}</span>
      </div>
      <ul className={styles.sidebarList}>
        <li>
          <span className={styles.sidebarGroup} data-open="">
            <StartIcon aria-hidden="true" />
            {start.title}
          </span>
          <ul className={styles.sidebarSub}>
            {DOCS_START_LINKS.map((link) => (
              <li key={link.label}>
                {link.href ? (
                  <Link
                    href={link.href}
                    className={styles.sidebarSubLink}
                    aria-current={link.href === currentPath ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <span className={styles.sidebarSubLink} aria-disabled="true" title={DOCS_UI.soon}>
                    {link.label}
                    <small>{DOCS_UI.soon}</small>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </li>
        {others.map((pillar) => {
          const Icon = DOCS_ICONS[pillar.icon];
          return (
            <li key={pillar.id}>
              {/* Chaque rubrique renvoie vers sa carte sur l'accueil de la documentation. */}
              <Link href={`/docs#${pillar.id}`} className={styles.sidebarLink}>
                <Icon aria-hidden="true" />
                <span>{pillar.title}</span>
                <ChevronRightIcon aria-hidden="true" className={styles.sidebarChevron} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface DocsLayoutProps {
  currentPath: string;
  toc: Array<{ id: string; label: string }>;
  /** Encarts sous le sommaire (colonne de droite). */
  aside?: ReactNode;
  children: ReactNode;
}

/** Documentation en trois colonnes : index, contenu, « Sur cette page ». */
export function DocsLayout({ currentPath, toc, aside, children }: DocsLayoutProps) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSticky}>
          <SidebarNav currentPath={currentPath} />
        </div>
        <details className={styles.mobileMenu}>
          <summary>
            {DOCS_UI.mobileMenu}
            <ChevronRightIcon aria-hidden="true" />
          </summary>
          <SidebarNav currentPath={currentPath} />
        </details>
      </aside>

      <div className={styles.content}>{children}</div>

      <aside className={styles.rightRail}>
        <div className={styles.rightSticky}>
          <DocsToc items={toc} />
          {aside}
        </div>
      </aside>
    </div>
  );
}
