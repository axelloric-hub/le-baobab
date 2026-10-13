"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";
import { authed, nextPath, type Page } from "@/lib/api/authed";
import { openSocket } from "@/lib/realtime/socket";
import { messagingApi } from "@/features/messaging/api";
import { msgKeys } from "@/features/messaging/hooks";
import { notificationsApi, type AppNotification, type NotificationPreferences } from "./api";

export const unreadKey = ["notifications", "unread"] as const;

/** Compteur de notifications non lues (lecture ; le temps réel passe par useNotificationSocket). */
export function useUnreadNotifications() {
  const query = useQuery({
    queryKey: unreadKey,
    queryFn: () => authed<{ unread: number }>("/notifications/unread-count/").then((r) => r.unread),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  return query.data ?? 0;
}

/**
 * Canal temps réel personnel (une seule connexion pour toute l'application, ouverte par le gabarit) :
 * la pastille augmente, les listes se rechargent et un événement « baobab:notification » est émis.
 */
export function useNotificationSocket() {
  const client = useQueryClient();
  useEffect(() => {
    const socket = openSocket("/ws/notifications/", (message) => {
      const event = message as { type?: string; code?: string; data?: Record<string, unknown> };
      if (event?.type === "notification") {
        client.setQueryData<number>(unreadKey, (count) => (count ?? 0) + 1);
        void client.invalidateQueries({ queryKey: notifKeys.lists });
        // Une mention vient d'une conversation : la boîte de réception change aussi.
        if (event.code === "mention" || event.code === "message") void client.invalidateQueries({ queryKey: msgKeys.inbox });
        window.dispatchEvent(new CustomEvent("baobab:notification", { detail: event }));
      }
    });
    return () => socket.close();
  }, [client]);
}

/** Messages non lus : somme des compteurs de la boîte de réception (même cache que la page Messages). */
export function useUnreadMessages() {
  const query = useQuery({
    queryKey: msgKeys.inbox,
    queryFn: messagingApi.inbox,
    staleTime: 10_000,
    refetchInterval: 60_000,
    select: (list) => list.reduce((sum, c) => sum + (c.unread || 0), 0),
  });
  return query.data ?? 0;
}

export const notifKeys = {
  lists: ["notifications", "list"] as const,
  list: (unread: boolean) => ["notifications", "list", unread ? "unread" : "all"] as const,
  prefs: ["notifications", "preferences"] as const,
};

export function useNotificationList(unread: boolean, enabled = true) {
  return useInfiniteQuery({
    queryKey: notifKeys.list(unread),
    queryFn: ({ pageParam }) => notificationsApi.list(unread, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<AppNotification>) => nextPath(last.next),
    enabled,
    staleTime: 15_000,
  });
}

/** Marquer comme lu (une, plusieurs, ou toutes) : listes et pastille mises à jour tout de suite. */
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids),
    onMutate: (ids) => {
      const newlyRead = new Set<string>();
      client.setQueriesData<InfiniteData<Page<AppNotification>>>({ queryKey: notifKeys.lists }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                results: page.results.map((n) => {
                  if (n.read || (ids && !ids.includes(n.id))) return n;
                  newlyRead.add(n.id);
                  return { ...n, read: true };
                }),
              })),
            }
          : data,
      );
      client.setQueryData<number>(unreadKey, (count) => (ids ? Math.max(0, (count ?? 0) - newlyRead.size) : 0));
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: unreadKey });
      void client.invalidateQueries({ queryKey: notifKeys.list(true) });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: notifKeys.prefs, queryFn: notificationsApi.preferences, staleTime: 5 * 60_000 });
}

export function useSetNotificationPreference() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, channels, enabled }: { type: string; channels: string[]; enabled: boolean }) => {
      for (const channel of channels) await notificationsApi.setPreference(type, channel, enabled);
    },
    onMutate: ({ type, channels, enabled }) => {
      const previous = client.getQueryData<NotificationPreferences>(notifKeys.prefs);
      client.setQueryData<NotificationPreferences>(notifKeys.prefs, (data) => {
        if (!data) return data;
        const others = data.preferences.filter((p) => !(p.type === type && channels.includes(p.channel)));
        return { ...data, preferences: [...others, ...channels.map((channel) => ({ type, channel, enabled }))] };
      });
      return { previous };
    },
    onError: (_e, _v, context) => context?.previous && client.setQueryData(notifKeys.prefs, context.previous),
  });
}
