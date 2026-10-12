"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { BRAND } from "@/components/landing/landing-content";
import { useMe, useMyEnrollments, useMyGroups } from "@/features/me/me";
import { useUnreadMessages, useUnreadNotifications } from "@/features/notifications/hooks";
import { currentUser, endSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import {
  BellIcon,
  BookmarkIcon,
  ChevronDownIcon,
  GlobeIcon,
  HashIcon,
  HomeIcon,
  ImageIcon,
  LogoutIcon,
  MessageIcon,
  PenIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "../ui/icons";
import { Menu, type MenuEntry } from "../ui/Menu";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { useCreation } from "./creation-context";
import { NAV_APPS, SOON } from "./nav";
import styles from "./Shell.module.css";

function useIdentity() {
  const me = useMe();
  const stored = currentUser();
  const username = me.data?.username ?? stored?.username ?? "";
  return { username, name: me.data?.display_name || username, avatar: me.data?.avatar_url ?? null };
}

function useLogout() {
  const router = useRouter();
  const client = useQueryClient();
  return async () => {
    await endSession();
    client.clear();
    router.replace(ROUTES.login);
  };
}

/** Bouton d'une application pas encore livrée : compteur réel, mais pas de page derrière. */
function SoonIconButton({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={cx(ui.iconButton, styles.soonButton)}
      aria-label={`${label}${count ? ` : ${count} non lus` : ""} (bientôt disponible)`}
      title={`${label} — ${SOON.toLowerCase()}`}
      onClick={() => toast(`${label} : cet espace arrive avec la prochaine mise à jour.`)}
    >
      {children}
      {count > 0 && <span className={ui.badge}>{count > 99 ? "99+" : count}</span>}
    </button>
  );
}

function TopBar() {
  const { openPost, openSearch } = useCreation();
  const identity = useIdentity();
  const logout = useLogout();
  const notifications = useUnreadNotifications();
  const messages = useUnreadMessages();

  const profileMenu: MenuEntry[] = [
    { kind: "link", label: "Mes enregistrements", href: ROUTES.saved, icon: <BookmarkIcon /> },
    { kind: "link", label: "Découvrir LE BAOBAB", href: ROUTES.discover, icon: <GlobeIcon /> },
    { kind: "separator" },
    { label: "Se déconnecter", icon: <LogoutIcon />, onSelect: () => void logout() },
  ];

  return (
    <header className={styles.topbar}>
      <Link href={ROUTES.feed} className={styles.brand} aria-label={`${BRAND.name} — fil d'actualité`}>
        <BaobabMark className={styles.brandMark} title={null} />
        <span className={styles.brandText}>
          <span className={styles.brandName}>{BRAND.name}</span>
          <span className={styles.brandTagline}>{BRAND.tagline}</span>
        </span>
      </Link>

      <button type="button" className={styles.search} onClick={openSearch} aria-keyshortcuts="Control+K Meta+K">
        <SearchIcon />
        <span>Rechercher un hashtag, une page…</span>
        <kbd className={styles.kbd}>Ctrl K</kbd>
      </button>

      <div className={styles.actions}>
        <button type="button" className={cx(ui.button, ui.primary, styles.createButton)} onClick={() => openPost()}>
          <PlusIcon />
          Créer
        </button>
        <button type="button" className={cx(ui.iconButton, styles.mobileOnly)} onClick={openSearch} aria-label="Rechercher">
          <SearchIcon />
        </button>
        <span className={styles.desktopOnly}>
          <SoonIconButton label="Messages" count={messages}>
            <MessageIcon />
          </SoonIconButton>
        </span>
        <SoonIconButton label="Notifications" count={notifications}>
          <BellIcon />
        </SoonIconButton>
        <span className={styles.desktopOnly}>
          <Menu
            label="Mon compte"
            items={profileMenu}
            triggerClassName={styles.profileButton}
            trigger={
              <>
                <Avatar name={identity.name || "?"} src={identity.avatar} size={36} />
                <span className={styles.profileText}>
                  <span className={styles.profileName}>{identity.name}</span>
                  {identity.username && <span className={styles.profileHandle}>@{identity.username}</span>}
                </span>
                <ChevronDownIcon width={16} height={16} className={styles.desktopOnly} />
              </>
            }
          />
        </span>
      </div>
    </header>
  );
}

function SideNav() {
  const pathname = usePathname();
  const groups = useMyGroups(true);
  const courses = useMyEnrollments();

  return (
    <nav className={styles.sidenav} aria-label="Applications">
      <ul className={styles.navList}>
        {NAV_APPS.map(({ id, label, href, Icon }) => (
          <li key={id}>
            {href ? (
              <Link href={href} className={styles.navLink} aria-current={pathname === href ? "page" : undefined} title={label}>
                <Icon />
                <span className={styles.navLabel}>{label}</span>
              </Link>
            ) : (
              <span className={styles.navLink} aria-disabled="true" title={`${label} — ${SOON.toLowerCase()}`}>
                <Icon />
                <span className={styles.navLabel}>{label}</span>
                <span className={styles.soon}>{SOON}</span>
              </span>
            )}
          </li>
        ))}
        <li>
          <Link href={ROUTES.saved} className={styles.navLink} aria-current={pathname === ROUTES.saved ? "page" : undefined} title="Enregistrés">
            <BookmarkIcon />
            <span className={styles.navLabel}>Enregistrés</span>
          </Link>
        </li>
      </ul>

      {groups.data && groups.data.length > 0 && (
        <section className={styles.navSection} aria-labelledby="nav-groupes">
          <h2 id="nav-groupes" className={styles.navHeading}>
            Mes groupes
          </h2>
          <ul className={styles.navMini}>
            {groups.data.slice(0, 5).map((group) => (
              <li key={group.slug} className={styles.navMiniItem}>
                <Avatar name={group.name} src={group.avatar_url} size={24} />
                <span>{group.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.data && courses.data.length > 0 && (
        <section className={styles.navSection} aria-labelledby="nav-cours">
          <h2 id="nav-cours" className={styles.navHeading}>
            Mes cours
          </h2>
          {courses.data.map((enrollment) => {
            const percent = Math.round(enrollment.progress.percent);
            return (
              <div key={enrollment.course.id} className={styles.course}>
                <span className={styles.courseTitle}>{enrollment.course.title}</span>
                <span className={styles.courseMeta}>Progression&nbsp;: {percent}&nbsp;%</span>
                <span
                  className={styles.progress}
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progression du cours ${enrollment.course.title}`}
                >
                  <span style={{ width: `${percent}%` }} />
                </span>
              </div>
            );
          })}
        </section>
      )}

      <p className={styles.navFooter}>
        <Link href="/docs">Documentation</Link> · <Link href="/blog">Blog</Link> · <Link href={ROUTES.discover} prefetch={false}>À propos</Link>
        <br />© {new Date().getFullYear()} {BRAND.name}
      </p>
    </nav>
  );
}

/** Barre d'onglets mobile : uniquement des destinations qui existent (loi de Jakob : 5 onglets, « + » au centre). */
function BottomBar() {
  const pathname = usePathname();
  const { openSearch, openPost, openStatus } = useCreation();
  const logout = useLogout();
  const identity = useIdentity();
  const [createOpen, setCreateOpen] = useState(false);

  const meMenu: MenuEntry[] = [
    { kind: "link", label: "Découvrir LE BAOBAB", href: ROUTES.discover, icon: <GlobeIcon /> },
    { kind: "separator" },
    { label: "Se déconnecter", icon: <LogoutIcon />, onSelect: () => void logout() },
  ];

  return (
    <>
      <nav className={styles.bottombar} aria-label="Navigation principale">
        <Link href={ROUTES.feed} className={styles.tab} aria-current={pathname === ROUTES.feed ? "page" : undefined}>
          <HomeIcon />
          Accueil
        </Link>
        <button type="button" className={styles.tab} onClick={openSearch}>
          <HashIcon />
          Explorer
        </button>
        <button type="button" className={styles.tabCreate} onClick={() => setCreateOpen(true)} aria-label="Créer" aria-haspopup="dialog">
          <PlusIcon />
        </button>
        <Link href={ROUTES.saved} className={styles.tab} aria-current={pathname === ROUTES.saved ? "page" : undefined}>
          <BookmarkIcon />
          Enregistrés
        </Link>
        <div className={styles.tabMenu}>
          <Menu
            label={`Mon compte${identity.username ? ` (@${identity.username})` : ""}`}
            items={meMenu}
            side="top"
            triggerClassName={styles.tab}
            trigger={
              <>
                <UserIcon />
                Moi
              </>
            }
          />
        </div>
      </nav>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Créer" size="sm">
        <div className={styles.createGrid}>
          <button
            type="button"
            className={styles.createOption}
            onClick={() => {
              setCreateOpen(false);
              openPost();
            }}
          >
            <span className={styles.createIcon}>
              <PenIcon />
            </span>
            <span>
              <strong>Publication</strong>
              <small>Texte, images, code, lien, sondage ou projet</small>
            </span>
          </button>
          <button
            type="button"
            className={styles.createOption}
            onClick={() => {
              setCreateOpen(false);
              openStatus();
            }}
          >
            <span className={styles.createIcon} data-tone="blue">
              <ImageIcon />
            </span>
            <span>
              <strong>Statut</strong>
              <small>Visible 24&nbsp;heures</small>
            </span>
          </button>
        </div>
      </Dialog>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.app}>
      <a href="#contenu" className={styles.skip}>
        Aller au contenu
      </a>
      <TopBar />
      <div className={styles.frame}>
        <SideNav />
        <main id="contenu" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
      <BottomBar />
    </div>
  );
}
