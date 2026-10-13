"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useInbox } from "@/features/messaging/hooks";
import type { Conversation } from "@/features/messaging/types";
import { currentUser } from "@/lib/auth/session";
import { useMe } from "@/features/me/me";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { HubIcon, PenIcon, SearchIcon } from "../ui/icons";
import { ErrorState, Skeleton } from "../ui/States";
import ui from "../ui/ui.module.css";
import { kindLabel, listTime } from "./labels";
import styles from "./Messages.module.css";
import { NewConversationDialog } from "./NewConversationDialog";

type Filter = "all" | "unread" | "groups";

export function ConversationAvatar({ conversation, size = 48 }: { conversation: Conversation; size?: 40 | 48 }) {
  if (conversation.type === "group") {
    return (
      <span className={styles.groupAvatar} style={{ width: size, height: size }} aria-hidden="true">
        <HubIcon />
      </span>
    );
  }
  const other = conversation.with;
  return (
    <span className={styles.avatarWrap}>
      <Avatar name={other?.display_name || other?.username || conversation.title || "?"} src={other?.avatar_url} size={size} />
      {other?.online && <span className={styles.online} aria-label="En ligne" />}
    </span>
  );
}

function preview(conversation: Conversation, me: string) {
  const last = conversation.last_message;
  if (!last) return "Aucun message pour l'instant";
  const text = last.body ? last.body.replace(/\s+/g, " ") : kindLabel(last.kind, last.attachments);
  const from = last.sender === me ? "Vous : " : conversation.type === "group" && last.sender_name ? `${last.sender_name.split(" ")[0]} : ` : "";
  return from + (last.kind === "code" && last.body ? `💻 ${text}` : text);
}

/** Liste des conversations : filtres, recherche, pastilles de non-lus, nouvelle discussion. */
export function ConversationList({ activeId }: { activeId: string | null }) {
  const inbox = useInbox();
  const me = useMe();
  const myUsername = me.data?.username ?? currentUser()?.username ?? "";
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (inbox.data ?? []).filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "groups" && c.type !== "group") return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || (c.with?.username ?? "").includes(q.replace(/^@/, ""));
    });
  }, [inbox.data, filter, query]);

  const unreadCount = (inbox.data ?? []).filter((c) => c.unread > 0).length;
  const groupCount = (inbox.data ?? []).filter((c) => c.type === "group").length;

  return (
    <section className={styles.listPane} aria-labelledby="messages-titre">
      <div className={styles.listHead}>
        <div className={styles.listTitleRow}>
          <h1 id="messages-titre" className={styles.listTitle}>
            Messages
          </h1>
          <button type="button" className={cx(ui.button, ui.primary, ui.small)} onClick={() => setCreating(true)} aria-haspopup="dialog">
            <PenIcon />
            Nouveau
          </button>
        </div>
        <label className={styles.search}>
          <SearchIcon aria-hidden="true" />
          <span className="bb-visually-hidden">Rechercher une conversation</span>
          <input type="search" placeholder="Rechercher une conversation" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className={styles.filters} role="group" aria-label="Filtrer les conversations">
          {(
            [
              ["all", "Toutes"],
              ["unread", unreadCount ? `Non lues (${unreadCount})` : "Non lues"],
              ["groups", groupCount ? `Groupes (${groupCount})` : "Groupes"],
            ] as Array<[Filter, string]>
          ).map(([value, label]) => (
            <button key={value} type="button" className={cx(ui.chip, ui.small)} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {inbox.isPending ? (
        <div className={styles.items} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.item}>
              <Skeleton width={48} height={48} radius="50%" />
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton width="55%" height={12} />
                <Skeleton width="80%" height={11} />
              </span>
            </div>
          ))}
        </div>
      ) : inbox.isError ? (
        <div style={{ padding: 16 }}>
          <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} />
        </div>
      ) : list.length === 0 ? (
        <p className={styles.listEmpty}>
          {(inbox.data ?? []).length === 0
            ? "Aucune conversation pour l'instant. Écrivez à un membre avec « Nouveau » ou depuis son profil."
            : "Aucune conversation ne correspond."}
        </p>
      ) : (
        <ul className={styles.items}>
          {list.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className={styles.item}
                aria-current={conversation.id === activeId ? "page" : undefined}
                data-unread={conversation.unread > 0 || undefined}
              >
                <ConversationAvatar conversation={conversation} />
                <span className={styles.itemText}>
                  <span className={styles.itemTop}>
                    <span className={styles.itemName}>{conversation.title || "Conversation"}</span>
                    <span className={styles.itemTime}>{listTime(conversation.last_message?.created_at ?? conversation.last_message_at)}</span>
                  </span>
                  <span className={styles.itemBottom}>
                    <span className={styles.itemPreview}>{preview(conversation, myUsername)}</span>
                    {conversation.unread > 0 && (
                      <span className={styles.unread} aria-label={`${conversation.unread} non lus`}>
                        {conversation.unread > 99 ? "99+" : conversation.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewConversationDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
