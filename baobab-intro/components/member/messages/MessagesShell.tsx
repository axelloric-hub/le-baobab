"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConversationList } from "./ConversationList";
import styles from "./Messages.module.css";

/** Messagerie : liste à gauche, conversation à droite (ordinateur) ; l'une ou l'autre sur mobile. */
export function MessagesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeId = /^\/messages\/([^/]+)/.exec(pathname)?.[1] ?? null;
  return (
    <div className={styles.shell} data-open={activeId ? "" : undefined} data-fullheight>
      <ConversationList activeId={activeId} />
      {children}
    </div>
  );
}
