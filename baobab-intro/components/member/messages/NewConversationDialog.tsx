"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { messagingApi } from "@/features/messaging/api";
import { msgKeys } from "@/features/messaging/hooks";
import { usePeopleSearch } from "@/features/people/hooks";
import type { UserBrief } from "@/features/social/types";
import { describeError } from "@/lib/api/errors";
import { AudiencePicker } from "../composer/AudiencePicker";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Spinner } from "../ui/States";
import ui from "../ui/ui.module.css";
import styles from "./Messages.module.css";

/** Ouvre une conversation (directe ou de groupe) puis y emmène. */
export function useOpenConversation() {
  const router = useRouter();
  const client = useQueryClient();
  return async (username: string) => {
    const { id } = await messagingApi.openDirect(username);
    void client.invalidateQueries({ queryKey: msgKeys.inbox });
    router.push(`/messages/${id}`);
  };
}

export function NewConversationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <NewConversation onClose={onClose} /> : null;
}

function NewConversation({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const openDirect = useOpenConversation();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<UserBrief[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = usePeopleSearch(query);

  const start = async (user: UserBrief) => {
    setBusy(true);
    setError(null);
    try {
      await openDirect(user.username);
      onClose();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  const createGroup = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await messagingApi.createGroup(
        members.map((m) => m.username),
        title.trim(),
      );
      void client.invalidateQueries({ queryKey: msgKeys.inbox });
      onClose();
      router.push(`/messages/${id}`);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title="Nouvelle discussion"
      footer={
        mode === "group" ? (
          <>
            <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={busy}>
              Annuler
            </button>
            <button type="button" className={cx(ui.button, ui.primary)} onClick={createGroup} disabled={busy || members.length === 0}>
              Créer le groupe
            </button>
          </>
        ) : undefined
      }
    >
      <div role="radiogroup" aria-label="Type de discussion" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" role="radio" aria-checked={mode === "direct"} className={ui.chip} onClick={() => setMode("direct")}>
          Avec une personne
        </button>
        <button type="button" role="radio" aria-checked={mode === "group"} className={ui.chip} onClick={() => setMode("group")}>
          Groupe
        </button>
      </div>

      {mode === "direct" ? (
        <>
          <label className={ui.label} htmlFor="new-chat-search">
            Rechercher un membre
          </label>
          <input
            id="new-chat-search"
            data-autofocus
            className={ui.input}
            type="search"
            placeholder="Nom ou @pseudo"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim().length >= 2 && (
            <ul className={styles.people} aria-label="Membres trouvés" aria-busy={search.isFetching}>
              {search.isPending && (
                <li style={{ padding: 12 }}>
                  <Spinner label="Recherche" />
                </li>
              )}
              {search.data?.length === 0 && <li className={styles.listEmpty}>Aucun membre ne correspond.</li>}
              {search.data?.map((user) => (
                <li key={user.username}>
                  <button type="button" className={styles.person} onClick={() => start(user)} disabled={busy}>
                    <Avatar name={user.display_name || user.username} src={user.avatar_url} size={40} />
                    <span>
                      <strong>{user.display_name || user.username}</strong>
                      <small>@{user.username}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length < 2 && <p className={ui.hint}>Tapez au moins deux lettres.</p>}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className={ui.label} htmlFor="new-group-title">
              Nom du groupe (facultatif)
            </label>
            <input id="new-group-title" className={ui.input} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. : Équipe API paiements" />
          </div>
          <AudiencePicker value={members} onChange={setMembers} />
        </div>
      )}
      {error && (
        <p className={ui.fieldError} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
