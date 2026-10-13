"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import { messagingApi } from "./api";
import type { Conversation, Message, SendInput } from "./types";

export const msgKeys = {
  inbox: ["conversations"] as const,
  history: (id: string) => ["conversation", id] as const,
};

/** Boîte de réception (rafraîchie toutes les 30 s et au retour sur l'onglet). */
export function useInbox() {
  return useQuery({
    queryKey: msgKeys.inbox,
    queryFn: messagingApi.inbox,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Historique d'une conversation, du plus récent au plus ancien (pages de 50). */
export function useHistory(id: string) {
  return useInfiniteQuery({
    queryKey: msgKeys.history(id),
    queryFn: ({ pageParam }) => messagingApi.history(id, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Message>) => nextPath(last.next),
    staleTime: 5_000,
  });
}

type History = InfiniteData<Page<Message>>;

/** Remplace / ajoute / retire un message dans le cache de l'historique. */
export function patchHistory(client: QueryClient, id: string, update: (messages: Message[]) => Message[]) {
  client.setQueryData<History>(msgKeys.history(id), (data) => {
    if (!data) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first, results: update(first.results) }, ...rest] };
  });
}

export function patchMessage(client: QueryClient, id: string, messageId: string, update: (m: Message) => Message | null) {
  client.setQueryData<History>(msgKeys.history(id), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.flatMap((m) => {
              if (m.id !== messageId) return [m];
              const next = update(m);
              return next ? [next] : [];
            }),
          })),
        }
      : data,
  );
}

/**
 * Nouveaux messages signalés par le WebSocket : on recharge la page la plus récente
 * et on la fusionne avec l'historique déjà chargé (les messages locaux en attente restent).
 */
export async function refreshLatest(client: QueryClient, id: string) {
  const latest = await messagingApi.history(id);
  client.setQueryData<History>(msgKeys.history(id), (data) => {
    if (!data) return { pages: [latest], pageParams: [null] };
    const known = new Set(latest.results.map((m) => m.id));
    const pending = data.pages[0].results.filter((m) => m.local && !known.has(m.id));
    const older = data.pages[0].results.filter((m) => !m.local && !known.has(m.id) && m.seq < (latest.results.at(-1)?.seq ?? 0));
    return { ...data, pages: [{ ...latest, results: [...pending, ...latest.results, ...older] }, ...data.pages.slice(1)] };
  });
}

/** Envoi optimiste : la bulle apparaît tout de suite (horloge), puis est remplacée par la version du serveur. */
export function useSendMessage(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SendInput) => messagingApi.send(id, input),
    onMutate: (input) => {
      const local: Message = {
        id: `local-${input.client_msg_id}`,
        seq: Number.MAX_SAFE_INTEGER,
        sender: null,
        kind: input.kind ?? "text",
        body: input.body,
        metadata: input.metadata ?? {},
        reply_to: input.reply_to ?? null,
        thread_root: null,
        reply_count: 0,
        edited_at: null,
        created_at: new Date().toISOString(),
        attachments: [],
        reactions: {},
        local: { state: "sending", clientId: input.client_msg_id, input },
      };
      patchHistory(client, id, (list) => [local, ...list.filter((m) => m.id !== local.id)]);
    },
    onSuccess: (message, input) => {
      patchHistory(client, id, (list) => {
        const without = list.filter((m) => m.id !== `local-${input.client_msg_id}` && m.id !== message.id);
        return [message, ...without];
      });
      client.setQueryData<Conversation[]>(msgKeys.inbox, (list) =>
        list?.map((c) =>
          c.id === id
            ? {
                ...c,
                last_message_at: message.created_at,
                last_read_seq: message.seq,
                message_seq: message.seq,
                last_message: { id: message.id, seq: message.seq, kind: message.kind, body: message.body.slice(0, 140), sender: message.sender?.username ?? null, sender_name: message.sender?.display_name ?? null, attachments: message.attachments.length, created_at: message.created_at },
              }
            : c,
        ),
      );
    },
    onError: (_error, input) => {
      patchMessage(client, id, `local-${input.client_msg_id}`, (m) => ({ ...m, local: { ...m.local!, state: "failed" } }));
    },
  });
}

export function useReactMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ message, emoji }: { message: Message; emoji: string }) => messagingApi.react(message.id, emoji),
    onMutate: ({ message, emoji }) => {
      const mine = message.my_reactions?.includes(emoji) ?? false;
      patchMessage(client, conversationId, message.id, (m) => {
        const count = (m.reactions[emoji] ?? 0) + (mine ? -1 : 1);
        const reactions = { ...m.reactions };
        if (count > 0) reactions[emoji] = count;
        else delete reactions[emoji];
        const my = new Set(m.my_reactions ?? []);
        if (mine) my.delete(emoji);
        else my.add(emoji);
        return { ...m, reactions, my_reactions: [...my] };
      });
      return { message };
    },
    onError: (_e, _v, context) => context && patchMessage(client, conversationId, context.message.id, () => context.message),
  });
}

export function useEditMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) => messagingApi.edit(messageId, body),
    onSuccess: (message) => patchMessage(client, conversationId, message.id, () => message),
  });
}

export function useDeleteMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, forEveryone }: { messageId: string; forEveryone: boolean }) => messagingApi.remove(messageId, forEveryone),
    onSuccess: (_d, { messageId }) => {
      patchMessage(client, conversationId, messageId, () => null);
      void client.invalidateQueries({ queryKey: msgKeys.inbox });
    },
  });
}

/** Marque la conversation comme lue jusqu'au dernier message affiché (pastilles mises à jour tout de suite). */
export function markConversationRead(client: QueryClient, id: string, seq: number) {
  const conv = client.getQueryData<Conversation[]>(msgKeys.inbox)?.find((c) => c.id === id);
  if (conv && conv.last_read_seq >= seq && conv.unread === 0) return;
  client.setQueryData<Conversation[]>(msgKeys.inbox, (list) => list?.map((c) => (c.id === id ? { ...c, unread: 0, last_read_seq: Math.max(c.last_read_seq, seq) } : c)));
  messagingApi.read(id, seq).catch(() => {});
}
