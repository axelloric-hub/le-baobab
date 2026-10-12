"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { BRAND } from "@/components/landing/landing-content";
import { useMe } from "@/features/me/me";
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
        <Link href={ROUTES.saved} className={styles.tab} aria-current={pathname === ROUTES.saved ? "page" : undefined}>
          <BookmarkIcon />
          Enregistrés
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
