"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { CloseIcon, MenuIcon } from "./icons";
<<<<<<< HEAD
import { ROUTES } from "@/lib/routes";
import { BRAND, JOIN_BUTTON_LABEL, LOGIN_LINK_LABEL, NAV_ITEMS, PENDING_LABEL, type NavItem } from "./landing-content";
=======
import { BRAND, JOIN_BUTTON_LABEL, NAV_ITEMS, PENDING_LABEL, type NavItem } from "./landing-content";
>>>>>>> 066290c7fadeff60e3873964e049f10a544e8eb8
import styles from "./SiteHeader.module.css";

/** Largeur à partir de laquelle la navigation complète est affichée (doit suivre le CSS). */
const DESKTOP_NAV_QUERY = "(min-width: 1100px)";

/** Lien actif : « / » uniquement sur l'accueil, « /blog » aussi sur « /blog/… ». */
function isCurrentPage(href: string, pathname: string) {
  if (href.includes("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavEntry({ item, className, onNavigate }: { item: NavItem; className: string; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  if (item.href?.startsWith("/#") && pathname === "/") {
    // Section de la page d'accueil, déjà affichée : ancre HTML native (défilement du navigateur,
    // sans passer par le routeur ni rejouer la cinématique).
    return (
      <a href={item.href.slice(1)} className={className} onClick={onNavigate}>
        {item.label}
      </a>
    );
  }
  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        aria-current={isCurrentPage(item.href, pathname) ? "page" : undefined}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  }
  // Pas encore de page : visible, non cliquable, signalé aux lecteurs d'écran.
  return (
    <span className={className} aria-disabled="true" title={PENDING_LABEL} data-pending="">
      {item.label}
    </span>
  );
}

<<<<<<< HEAD
/** « Rejoindre » : création de compte. */
function JoinButton({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  return (
    <Link href={ROUTES.register} className={className} data-auth-link="register" onClick={onNavigate}>
      {JOIN_BUTTON_LABEL}
    </Link>
  );
}

/** « Se connecter » : pour les membres qui reviennent. */
function LoginLink({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  return (
    <Link href={ROUTES.login} className={className} onClick={onNavigate}>
      {LOGIN_LINK_LABEL}
    </Link>
=======
/** Bouton « Rejoindre » — strictement visuel dans cette phase : aucune route, aucune action. */
function JoinButton({ className }: { className: string }) {
  return (
    <button type="button" className={className} aria-disabled="true" title={PENDING_LABEL} data-pending="rejoindre">
      {JOIN_BUTTON_LABEL}
    </button>
>>>>>>> 066290c7fadeff60e3873964e049f10a544e8eb8
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Fermeture : Échap, ou passage en largeur ordinateur.
  useEffect(() => {
    if (!menuOpen) return;
    const desktop = window.matchMedia(DESKTOP_NAV_QUERY);
    const close = () => setMenuOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    desktop.addEventListener("change", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      desktop.removeEventListener("change", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className={styles.header} data-menu-open={menuOpen || undefined}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${BRAND.name} — accueil`}>
          <BaobabMark className={styles.brandMark} title={null} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{BRAND.name}</span>
            <span className={styles.brandTagline}>{BRAND.tagline}</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavEntry item={item} className={styles.navLink} />
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
<<<<<<< HEAD
          <LoginLink className={styles.loginLink} />
=======
>>>>>>> 066290c7fadeff60e3873964e049f10a544e8eb8
          <JoinButton className={styles.joinButton} />
          <button
            ref={toggleRef}
            type="button"
            className={styles.menuToggle}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <div id={menuId} className={styles.mobilePanel} hidden={!menuOpen}>
        <nav aria-label="Navigation mobile">
          <ul className={styles.mobileList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavEntry item={item} className={styles.mobileLink} onNavigate={() => setMenuOpen(false)} />
                {!item.href && <span className={styles.pendingTag}>Bientôt</span>}
              </li>
            ))}
          </ul>
        </nav>
<<<<<<< HEAD
        <div className={styles.mobileActions}>
          <JoinButton className={`${styles.joinButton} ${styles.mobileJoin}`} onNavigate={() => setMenuOpen(false)} />
          <LoginLink className={styles.mobileLogin} onNavigate={() => setMenuOpen(false)} />
        </div>
=======
        <JoinButton className={`${styles.joinButton} ${styles.mobileJoin}`} />
>>>>>>> 066290c7fadeff60e3873964e049f10a544e8eb8
      </div>
    </header>
  );
}
