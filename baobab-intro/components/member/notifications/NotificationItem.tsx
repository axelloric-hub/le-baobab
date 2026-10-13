"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { AppNotification } from "@/features/notifications/api";
import { useMarkNotificationsRead } from "@/features/notifications/hooks";
import { peopleApi } from "@/features/people/api";
import { describeError } from "@/lib/api/errors";
import { fullDate, relativeTime } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { describe } from "./describe";
import styles from "./Notifications.module.css";

const TONES = { brown: "#8a3a12", blue: "#2563eb", green: "#15803d", amber: "#b45309", red: "#b42318" };

/** Demande d'ami : réponse directe depuis la notification (target_id = identifiant de la demande). */
function FriendRequestActions({ notification, onDone }: { notification: AppNotification; onDone: () => void }) {
  const toast = useToast();
  const client = useQueryClient();
  const [state, setState] = useState<"idle" | "busy" | "accepted" | "declined">("idle");
  if (!notification.target_id || (state === "idle" && notification.read)) return null;
  if (state === "accepted") return <p className={styles.time}>Vous êtes maintenant amis.</p>;
  if (state === "declined") return <p className={styles.time}>Demande refusée.</p>;
  const answer = async (accept: boolean) => {
    setState("busy");
    try {
      await peopleApi.respondFriendRequest(notification.target_id!, accept);
      setState(accept ? "accepted" : "declined");
      onDone();
      if (notification.actor) void client.invalidateQueries({ queryKey: ["profile", notification.actor.username] });
    } catch (error) {
      setState("idle");
      toast(describeError(error), { tone: "error" });
    }
  };
  return (
    <div className={styles.actions}>
      <button type="button" className={cx(ui.button, ui.primary, ui.small)} disabled={state === "busy"} onClick={() => answer(true)}>
        Accepter
      </button>
      <button type="button" className={cx(ui.button, ui.secondary, ui.small)} disabled={state === "busy"} onClick={() => answer(false)}>
        Refuser
      </button>
    </div>
  );
}

export function NotificationItem({ notification, onNavigate }: { notification: AppNotification; onNavigate?: () => void }) {
  const mark = useMarkNotificationsRead();
  const { text, href, Icon, tone } = describe(notification);
  const read = () => !notification.read && mark.mutate([notification.id]);
  const color = TONES[tone];

  return (
    <li className={styles.item} data-unread={!notification.read || undefined} style={{ ["--tone" as string]: color }}>
      {href ? (
        <Link
          href={href}
          className={styles.itemLink}
          aria-labelledby={`notif-${notification.id}-text notif-${notification.id}-time`}
          onClick={() => {
            read();
            onNavigate?.();
          }}
        />
      ) : (
        <button type="button" className={styles.itemLink} style={{ border: 0, background: "transparent", cursor: notification.read ? "default" : "pointer" }} onClick={read} aria-labelledby={`notif-${notification.id}-text notif-${notification.id}-time`} />
      )}
      <span className={styles.visual}>
        {notification.actor ? (
          <>
            <Avatar name={notification.actor.display_name || notification.actor.username} src={notification.actor.avatar_url} size={44} />
            <span className={styles.typeBadge} aria-hidden="true">
              <Icon />
            </span>
          </>
        ) : (
          <span className={styles.typeIcon} aria-hidden="true">
            <Icon />
          </span>
        )}
      </span>
      <span className={styles.content}>
        <p className={styles.text} id={`notif-${notification.id}-text`}>
          {!notification.read && <span className="bb-visually-hidden">Non lue : </span>}
          {text}
        </p>
        <time id={`notif-${notification.id}-time`} className={styles.time} dateTime={notification.created_at} title={fullDate(notification.created_at)}>
          {relativeTime(notification.created_at)}
        </time>
        {notification.type === "friend_request" && <FriendRequestActions notification={notification} onDone={read} />}
      </span>
      {!notification.read && <span className={styles.dot} aria-hidden="true" />}
    </li>
  );
}
