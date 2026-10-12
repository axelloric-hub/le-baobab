"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { authed } from "@/lib/api/authed";
import { openSocket } from "@/lib/realtime/socket";

export const unreadKey = ["notifications", "unread"] as const;

/** Compteur de notifications non lues : lecture initiale + incrément en temps réel (WebSocket). */
export function useUnreadNotifications() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: unreadKey,
    queryFn: () => authed<{ unread: number }>("/notifications/unread-count/").then((r) => r.unread),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    const socket = openSocket("/ws/notifications/", (message) => {
      if ((message as { type?: string })?.type === "notification") {
        client.setQueryData<number>(unreadKey, (count) => (count ?? 0) + 1);
      }
    });
    return () => socket.close();
  }, [client]);

  return query.data ?? 0;
}

/** Messages non lus : somme des compteurs de mes conversations (GET /conversations/). */
export function useUnreadMessages() {
  const query = useQuery({
    queryKey: ["conversations", "unread"],
    queryFn: () => authed<Array<{ unread: number }>>("/conversations/").then((list) => list.reduce((sum, c) => sum + (c.unread || 0), 0)),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
  return query.data ?? 0;
}
