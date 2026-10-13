"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { InvitationsCard, SuggestedGroupsCard, TrendsCard } from "../rail/RightRail";
import { Avatar } from "../ui/Avatar";
import { BellIcon, BookmarkIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, FileIcon, GlobeIcon, LogoutIcon } from "../ui/icons";
import { MyCoursesSection, MyGroupsSection } from "./MySpaces";
import { NAV_APPS, SOON } from "./nav";
import styles from "./Shell.module.css";
import { ROUTES } from "@/lib/routes";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: { name: string; username: string; avatar: string | null };
  onLogout: () => void;
}

/** Distance (px) en dessous de laquelle un geste est un simple appui. */
const TAP_SLOP = 6;

/**
 * Panneau « Toutes les fonctionnalités » (mobile).
 * Une poignée avec une flèche animée dépasse de la barre d'onglets : on la tire vers le haut (ou on la touche)
 * et le panneau suit le doigt jusqu'à couvrir l'écran. On le referme en le tirant vers le bas, avec la croix,
 * la touche Échap ou le bouton retour du clavier.
 */
export function MobileDrawer({ open, onOpenChange, identity, onLogout }: MobileDrawerProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** Position du haut du panneau pendant le geste (0 = ouvert, hauteur de l'écran = fermé). */
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{ startY: number; startTime: number; base: number; moved: boolean } | null>(null);

  // Ouverture : le focus va dans le panneau ; fermeture : il revient sur la poignée.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) closeRef.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current) handleRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  // Page qui change (lien touché dans le panneau) : on referme.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname && open) onOpenChange(false);
    lastPath.current = pathname;
  }, [pathname, open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onOpenChange(false);
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const start = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { startY: event.clientY, startTime: performance.now(), base: open ? 0 : window.innerHeight, moved: false };
    },
    [open],
  );

  const move = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.abs(dy) < TAP_SLOP) return;
    g.moved = true;
    setDrag(Math.min(window.innerHeight, Math.max(0, g.base + dy)));
  }, []);

  const end = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      if (!g.moved) {
        setDrag(null);
        onOpenChange(!open);
        return;
      }
      const height = window.innerHeight;
      const dy = event.clientY - g.startY;
      const velocity = dy / Math.max(1, performance.now() - g.startTime); // px/ms, négatif = vers le haut
      const position = Math.min(height, Math.max(0, g.base + dy));
      // Un geste rapide suffit ; sinon il faut avoir parcouru un quart de l'écran.
      const next = open ? !(velocity > 0.45 || position > height * 0.25) : velocity < -0.45 || position < height * 0.75;
      setDrag(null);
      onOpenChange(next);
      navigator.vibrate?.(8);
    },
    [open, onOpenChange],
  );

  const gestureHandlers = { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  const dragging = drag !== null;
  const visible = open || dragging;

  const close = () => onOpenChange(false);

  return (
    <>
      <button
        ref={handleRef}
        type="button"
        className={styles.drawerHandle}
        aria-expanded={open}
        aria-controls="toutes-les-fonctionnalites"
        aria-label="Toutes les fonctionnalités"
        title="Tirez vers le haut pour voir toutes les fonctionnalités"
        {...gestureHandlers}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <ChevronUpIcon className={styles.drawerArrow} aria-hidden="true" />
      </button>

      <div
        ref={panelRef}
        id="toutes-les-fonctionnalites"
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-titre"
        data-open={open || undefined}
        data-dragging={dragging || undefined}
        inert={!visible}
        style={dragging ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <header className={styles.drawerHeader} {...gestureHandlers}>
          <span className={styles.drawerGrip} aria-hidden="true" />
          <h2 id="drawer-titre" className={styles.drawerTitle}>
            Toutes les fonctionnalités
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.drawerClose}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={close}
            aria-label="Fermer"
          >
            <CloseIcon />
          </button>
        </header>

        <div className={styles.drawerBody}>
          <Link href={identity.username ? ROUTES.profile(identity.username) : ROUTES.feed} className={styles.drawerProfile} onClick={close}>
            <Avatar name={identity.name || "?"} src={identity.avatar} size={48} />
            <span>
              <strong>{identity.name}</strong>
              {identity.username && <small>@{identity.username} · Voir mon profil</small>}
            </span>
          </Link>

          <h3 className={styles.drawerHeading}>Applications</h3>
          <ul className={styles.drawerApps}>
            {NAV_APPS.map(({ id, label, href, Icon }) => (
              <li key={id}>
                {href ? (
                  <Link href={href} className={styles.drawerApp} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined} onClick={close}>
                    <span className={styles.drawerAppIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    {label}
                  </Link>
                ) : (
                  <span className={styles.drawerApp} aria-disabled="true">
                    <span className={styles.drawerAppIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    {label}
                    <span className={styles.soon}>{SOON}</span>
                  </span>
                )}
              </li>
            ))}
            <li>
              <Link href={ROUTES.saved} className={styles.drawerApp} aria-current={pathname === ROUTES.saved ? "page" : undefined} onClick={close}>
                <span className={styles.drawerAppIcon}>
                  <BookmarkIcon aria-hidden="true" />
                </span>
                Enregistrés
              </Link>
            </li>
          </ul>

          <div className={styles.drawerCards}>
            <InvitationsCard />
            <MyGroupsSection limit={20} idPrefix="drawer" />
            <MyCoursesSection idPrefix="drawer" />
            <TrendsCard />
            <SuggestedGroupsCard />
          </div>

          <h3 className={styles.drawerHeading}>Compte et aide</h3>
          <ul className={styles.drawerLinks}>
            <li>
              <Link href={`${ROUTES.notifications}#parametres`} className={styles.drawerLink} onClick={close}>
                <BellIcon aria-hidden="true" />
                Notifications et paramètres
              </Link>
            </li>
            <li>
              <Link href={ROUTES.discover} prefetch={false} className={styles.drawerLink}>
                <GlobeIcon aria-hidden="true" />
                Découvrir LE BAOBAB
              </Link>
            </li>
            <li>
              <Link href="/docs" className={styles.drawerLink}>
                <FileIcon aria-hidden="true" />
                Documentation
              </Link>
            </li>
            <li>
              <button type="button" className={styles.drawerLink} data-tone="danger" onClick={onLogout}>
                <LogoutIcon aria-hidden="true" />
                Se déconnecter
              </button>
            </li>
          </ul>

          <button type="button" className={styles.drawerBottomClose} onClick={close}>
            <ChevronDownIcon aria-hidden="true" />
            Refermer
          </button>
        </div>
      </div>
    </>
  );
}
