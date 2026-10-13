"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMarkNotificationsRead, useNotificationList, useUnreadNotifications } from "@/features/notifications/hooks";
import { ROUTES } from "@/lib/routes";
import { cx } from "../ui/cx";
import { BellIcon, DoubleCheckIcon } from "../ui/icons";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import ui from "../ui/ui.module.css";
import { NotificationItem } from "./NotificationItem";
import styles from "./Notifications.module.css";

/** Cloche (ordinateur) : pastille temps réel + panneau déroulant des dernières notifications. */
export function NotificationBell() {
  const unread = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const list = useNotificationList(onlyUnread, open);
  const mark = useMarkNotificationsRead();
  const items = (list.data?.pages.flatMap((p) => p.results) ?? []).slice(0, 12);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.bellRoot} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={ui.iconButton}
        aria-label={`Notifications${unread ? ` : ${unread} non lues` : ""}`}
        aria-expanded={open}
        aria-controls={open ? "panneau-notifications" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unread > 0 && (
          <span key={unread} className={ui.badge}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section id="panneau-notifications" className={styles.panel} aria-label="Notifications récentes">
          <div className={styles.panelHead}>
            <div className={styles.panelTitleRow}>
              <h2 className={styles.panelTitle}>Notifications</h2>
              <button type="button" className={styles.textButton} disabled={unread === 0 || mark.isPending} onClick={() => mark.mutate(undefined)}>
                <DoubleCheckIcon width={15} height={15} style={{ verticalAlign: -3, marginRight: 4 }} />
                Tout marquer comme lu
              </button>
            </div>
            <div className={styles.tabs} role="group" aria-label="Filtrer">
              <button type="button" className={cx(ui.chip, ui.small)} aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>
                Toutes
              </button>
              <button type="button" className={cx(ui.chip, ui.small)} aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>
                Non lues{unread ? ` (${unread})` : ""}
              </button>
            </div>
          </div>
          <div className={styles.panelBody}>
            {list.isPending ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }} aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <Skeleton width={44} height={44} radius="50%" />
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      <Skeleton width="85%" height={12} />
                      <Skeleton width="30%" height={10} />
                    </span>
                  </div>
                ))}
              </div>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState icon={<DoubleCheckIcon />} title="Vous êtes à jour" text={onlyUnread ? "Aucune notification non lue." : "Aucune notification pour l'instant."} />
            ) : (
              <ul className={styles.list}>
                {items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            )}
          </div>
          <div className={styles.panelFoot}>
            <Link href={ROUTES.notifications} onClick={() => setOpen(false)}>
              Voir toutes les notifications
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
