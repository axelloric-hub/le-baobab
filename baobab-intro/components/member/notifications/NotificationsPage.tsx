"use client";

import { useMemo, useState } from "react";
import { useMarkNotificationsRead, useNotificationList, useNotificationPreferences, useSetNotificationPreference, useUnreadNotifications } from "@/features/notifications/hooks";
import type { AppNotification, NotificationPreferences } from "@/features/notifications/api";
import { describeError } from "@/lib/api/errors";
import { cx } from "../ui/cx";
import { DoubleCheckIcon, SettingsIcon } from "../ui/icons";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { CATEGORY_LABELS, TYPE_LABELS } from "./describe";
import { NotificationItem } from "./NotificationItem";
import styles from "./Notifications.module.css";

function bucket(iso: string) {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  const today = new Date().toDateString() === new Date(iso).toDateString();
  if (today) return "Aujourd'hui";
  if (days < 7) return "Cette semaine";
  return "Plus tôt";
}

/** Types déclarés par le backend mais qu'aucun événement n'émet encore : un réglage sans effet n'est pas proposé. */
const NOT_EMITTED = new Set(["message", "friend_accepted", "group_invitation", "group_join_approved"]);

/** Colonnes affichées : « dans l'application » (la notification existe ou non) et « e-mail ». */
const CHANNELS: Array<{ id: string; label: string; also?: string[] }> = [
  { id: "in_app", label: "Appli", also: ["websocket"] },
  { id: "email", label: "E-mail" },
];

function isEnabled(prefs: NotificationPreferences, type: NotificationPreferences["types"][number], channel: string) {
  if (type.critical) return true;
  const specific = prefs.preferences.find((p) => p.type === type.code && p.channel === channel);
  if (specific) return specific.enabled;
  const general = prefs.preferences.find((p) => p.type === null && p.channel === channel);
  if (general) return general.enabled;
  return (type.default_channels ?? []).includes(channel);
}

function PreferencesCard() {
  const prefs = useNotificationPreferences();
  const set = useSetNotificationPreference();
  const toast = useToast();
  const grouped = useMemo(() => {
    const out = new Map<string, NotificationPreferences["types"]>();
    for (const t of (prefs.data?.types ?? []).filter((t) => !NOT_EMITTED.has(t.code))) out.set(t.category, [...(out.get(t.category) ?? []), t]);
    return [...out.entries()];
  }, [prefs.data]);

  return (
    <section id="parametres" className={styles.prefs} aria-labelledby="prefs-titre">
      <h2 id="prefs-titre" className={styles.prefsTitle}>
        <SettingsIcon aria-hidden="true" />
        Paramètres des notifications
      </h2>
      <p className={styles.prefsLead}>
        Choisissez ce qui vous est signalé dans LE BAOBAB et par e-mail. Les alertes de sécurité et de paiement restent toujours actives. Chaque changement est enregistré
        immédiatement.
      </p>
      {prefs.isPending ? (
        <Spinner label="Chargement des paramètres" />
      ) : prefs.isError ? (
        <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} />
      ) : (
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th scope="col">Type</th>
              {CHANNELS.map((c) => (
                <th key={c.id} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([category, types]) => (
              <CategoryRows
                key={category}
                category={category}
                types={types}
                prefs={prefs.data!}
                onToggle={(type, channel, enabled) =>
                  set.mutate(
                    { type: type.code, channels: [channel.id, ...(channel.also ?? [])], enabled },
                    { onSuccess: () => toast("Enregistré.", { tone: "success", duration: 1600 }), onError: (e) => toast(describeError(e), { tone: "error" }) },
                  )
                }
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CategoryRows({
  category,
  types,
  prefs,
  onToggle,
}: {
  category: string;
  types: NotificationPreferences["types"];
  prefs: NotificationPreferences;
  onToggle: (type: NotificationPreferences["types"][number], channel: (typeof CHANNELS)[number], enabled: boolean) => void;
}) {
  return (
    <>
      <tr className={styles.category}>
        <th scope="rowgroup" colSpan={CHANNELS.length + 1}>
          {CATEGORY_LABELS[category] ?? category}
        </th>
      </tr>
      {types.map((t) => (
        <tr key={t.code}>
          <th scope="row">
            {TYPE_LABELS[t.code] ?? t.code}
            {t.critical && <span className={styles.locked}>Toujours active</span>}
          </th>
          {CHANNELS.map((c) => {
            const on = isEnabled(prefs, t, c.id);
            return (
              <td key={c.id}>
                <span className={styles.switch}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={on}
                    disabled={t.critical}
                    aria-label={`${TYPE_LABELS[t.code] ?? t.code} : ${c.id === "email" ? "par e-mail" : "dans l'application"}`}
                    onChange={(e) => onToggle(t, c, e.target.checked)}
                  />
                  <span className={styles.track} aria-hidden="true" />
                </span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/** Page « Notifications » : liste complète groupée par période + paramètres. */
export function NotificationsPage() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const unread = useUnreadNotifications();
  const list = useNotificationList(onlyUnread);
  const mark = useMarkNotificationsRead();
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.results) ?? [], [list.data]);
  const groups = useMemo(() => {
    const out: Array<[string, AppNotification[]]> = [];
    for (const n of items) {
      const label = bucket(n.created_at);
      const last = out.at(-1);
      if (last && last[0] === label) last[1].push(n);
      else out.push([label, [n]]);
    }
    return out;
  }, [items]);

  return (
    <div className={styles.page}>
      <div>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Notifications</h1>
            <p className={styles.lead}>{unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu."}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={cx(ui.button, ui.secondary, ui.small)} disabled={unread === 0 || mark.isPending} onClick={() => mark.mutate(undefined)}>
              <DoubleCheckIcon />
              Tout marquer comme lu
            </button>
            <a href="#parametres" className={cx(ui.button, ui.ghost, ui.small)}>
              <SettingsIcon />
              Paramètres
            </a>
          </div>
        </header>
        <div className={styles.tabs} role="group" aria-label="Filtrer" style={{ marginBottom: 12 }}>
          <button type="button" className={ui.chip} aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>
            Toutes
          </button>
          <button type="button" className={ui.chip} aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>
            Non lues{unread ? ` (${unread})` : ""}
          </button>
        </div>
        <div className={styles.card}>
          {list.isPending ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 12 }} aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <Skeleton width={44} height={44} radius="50%" />
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Skeleton width="80%" height={12} />
                    <Skeleton width="25%" height={10} />
                  </span>
                </div>
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<DoubleCheckIcon />}
              title="Vous êtes à jour"
              text={onlyUnread ? "Aucune notification non lue." : "Les demandes d'ami, commentaires, réactions et mentions apparaîtront ici en temps réel."}
            />
          ) : (
            groups.map(([label, group]) => (
              <section key={label} aria-label={label}>
                <h2 className={styles.group}>{label}</h2>
                <ul className={styles.list}>
                  {group.map((n) => (
                    <NotificationItem key={n.id} notification={n} />
                  ))}
                </ul>
              </section>
            ))
          )}
          {list.hasNextPage && (
            <button type="button" className={cx(ui.button, ui.secondary, ui.block)} style={{ marginTop: 8 }} onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? "Chargement…" : "Notifications plus anciennes"}
            </button>
          )}
        </div>
      </div>
      <PreferencesCard />
    </div>
  );
}
