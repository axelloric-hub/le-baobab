"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { BRAND } from "@/components/landing/landing-content";
import { useMe } from "@/features/me/me";
import { useNotificationSocket, useUnreadMessages, useUnreadNotifications } from "@/features/notifications/hooks";
import { NotificationBell } from "../notifications/NotificationBell";
import { liveText } from "../notifications/describe";
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
import { MobileDrawer } from "./MobileDrawer";
import { MyCoursesSection, MyGroupsSection } from "./MySpaces";
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

/** Icône avec pastille de compteur, menant à une page. */
function CountLink({ href, label, count, children, className }: { href: string; label: string; count: number; children: ReactNode; className?: string }) {
  const pathname = usePathname();
  return (
    <Link href={href} className={cx(ui.iconButton, className)} aria-label={`${label}${count ? ` : ${count} non lus` : ""}`} aria-current={pathname.startsWith(href) ? "page" : undefined}>
      {children}
      {count > 0 && (
        <span key={count} className={ui.badge}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Notification reçue en direct : toast discret, sauf si la page ou le panneau des notifications est déjà ouvert. */
function useLiveNotificationToast() {
  const toast = useToast();
  const pathname = usePathname();
  useEffect(() => {
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<{ code?: string; data?: Record<string, unknown> }>).detail;
      if (pathname === ROUTES.notifications || document.getElementById("panneau-notifications")) return;
      toast(liveText(detail?.code, detail?.data));
    };
    window.addEventListener("baobab:notification", onLive);
    return () => window.removeEventListener("baobab:notification", onLive);
  }, [pathname, toast]);
}

function TopBar() {
  const { openPost, openSearch } = useCreation();
  const identity = useIdentity();
  const logout = useLogout();
  const notifications = useUnreadNotifications();
  const messages = useUnreadMessages();

  const profileMenu: MenuEntry[] = [
    ...(identity.username ? [{ kind: "link" as const, label: "Mon profil", href: ROUTES.profile(identity.username), icon: <UserIcon /> }] : []),
    { kind: "link", label: "Mes enregistrements", href: ROUTES.saved, icon: <BookmarkIcon /> },
    { kind: "link", label: "Notifications et paramètres", href: `${ROUTES.notifications}#parametres`, icon: <BellIcon /> },
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
        <span>Rechercher une personne, un hashtag…</span>
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
          <CountLink href={ROUTES.messages} label="Messages" count={messages}>
            <MessageIcon />
          </CountLink>
        </span>
        <span className={styles.desktopOnly}>
          <NotificationBell />
        </span>
        <CountLink href={ROUTES.notifications} label="Notifications" count={notifications} className={styles.mobileOnly}>
          <BellIcon />
        </CountLink>
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

  return (
    <nav className={styles.sidenav} aria-label="Applications">
      <ul className={styles.navList}>
        {NAV_APPS.map(({ id, label, href, Icon }) => (
          <li key={id}>
            {href ? (
              <Link href={href} className={styles.navLink} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined} title={label}>
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

      <MyGroupsSection />
      <MyCoursesSection />

      <p className={styles.navFooter}>
        <Link href="/docs">Documentation</Link> · <Link href="/blog">Blog</Link> · <Link href={ROUTES.discover} prefetch={false}>À propos</Link>
        <br />© {new Date().getFullYear()} {BRAND.name}
      </p>
    </nav>
  );
}

/**
 * Barre d'onglets mobile (5 onglets, « + » au centre). La poignée au-dessus ouvre le panneau
 * « Toutes les fonctionnalités », qui donne sur mobile tout ce que l'ordinateur affiche en colonnes.
 */
function BottomBar({ drawerOpen, setDrawerOpen }: { drawerOpen: boolean; setDrawerOpen: (open: boolean) => void }) {
  const pathname = usePathname();
  const { openSearch, openPost, openStatus } = useCreation();
  const logout = useLogout();
  const identity = useIdentity();
  const messages = useUnreadMessages();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <nav className={styles.bottombar} aria-label="Navigation principale" inert={drawerOpen}>
        <MobileDrawerSlot>
          <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} identity={identity} onLogout={() => void logout()} />
        </MobileDrawerSlot>
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
        <Link href={ROUTES.messages} className={styles.tab} aria-current={pathname.startsWith(ROUTES.messages) ? "page" : undefined}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <MessageIcon />
            {messages > 0 && (
              <span className={ui.badge} style={{ top: -6, right: -10 }}>
                {messages > 99 ? "99+" : messages}
              </span>
            )}
          </span>
          Messages
        </Link>
        <button type="button" className={styles.tab} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} aria-controls="toutes-les-fonctionnalites">
          <UserIcon />
          Moi
        </button>
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

/** Le panneau mobile est rendu hors de la barre (sinon il hériterait de son inertie quand il est ouvert). */
function MobileDrawerSlot({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useNotificationSocket();
  useLiveNotificationToast();
  return (
    <div className={styles.app}>
      <a href="#contenu" className={styles.skip}>
        Aller au contenu
      </a>
      <div inert={drawerOpen} style={{ display: "contents" }}>
        <TopBar />
      </div>
      <div className={styles.frame} inert={drawerOpen}>
        <SideNav />
        <main id="contenu" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
      <BottomBar drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
    </div>
  );
}
