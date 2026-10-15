"use client";

import { useJoin } from "@/features/community/hooks";
import type { Group } from "@/features/community/types";
import { describeError } from "@/lib/api/errors";
import { cx } from "../ui/cx";
import { CheckIcon, ClockIcon, LockIcon, PlusIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";

/**
 * Bouton d'adhésion selon l'état réel : membre, demande en attente, sur invitation, rejoindre ou demander.
 * « Sur invitation » n'est pas cliquable : le serveur refuserait.
 */
export function JoinButton({ group, size = "md", block }: { group: Group; size?: "sm" | "md"; block?: boolean }) {
  const join = useJoin();
  const toast = useToast();
  const cls = (tone: string) => cx(ui.button, tone, size === "sm" && ui.small, block && ui.block);

  if (group.my_role) {
    return (
      <span className={cls(ui.ghost)} aria-disabled="true" style={{ cursor: "default" }}>
        <CheckIcon />
        Membre
      </span>
    );
  }
  if (group.my_request_pending) {
    return (
      <span className={cls(ui.ghost)} aria-disabled="true" style={{ cursor: "default" }}>
        <ClockIcon />
        Demande envoyée
      </span>
    );
  }
  if (group.join_policy === "invite_only") {
    return (
      <span className={cls(ui.ghost)} aria-disabled="true" style={{ cursor: "default" }} title="Ce groupe n'accepte que les personnes invitées">
        <LockIcon />
        Sur invitation
      </span>
    );
  }
  const open = group.join_policy === "open";
  return (
    <button
      type="button"
      className={cls(open ? ui.primary : ui.secondary)}
      disabled={join.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        join.mutate(group.slug, {
          onSuccess: (result) =>
            toast(result.status === "joined" ? `Bienvenue dans « ${group.name} ».` : "Demande envoyée : les modérateurs vont l'examiner.", { tone: "success" }),
          onError: (error) => toast(describeError(error), { tone: "error" }),
        });
      }}
    >
      <PlusIcon />
      {join.isPending ? "Envoi…" : open ? "Rejoindre" : "Demander à rejoindre"}
    </button>
  );
}
