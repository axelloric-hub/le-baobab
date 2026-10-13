/** Couche service de la messagerie : une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type { Conversation, Message, SendInput } from "./types";

export const messagingApi = {
  inbox: () => authed<Conversation[]>("/conversations/"),
  openDirect: (username: string) => authed<{ id: string; created: boolean }>("/conversations/direct/", { method: "POST", body: { username } }),
  createGroup: (usernames: string[], title: string) => authed<{ id: string }>("/conversations/group/", { method: "POST", body: { usernames, title } }),
  history: (id: string, path?: string) => authed<Page<Message>>(path ?? `/conversations/${id}/messages/`),
  send: (id: string, input: SendInput) => authed<Message>(`/conversations/${id}/messages/`, { method: "POST", body: input }),
  read: (id: string, upToSeq: number) => authed<{ last_read_seq: number }>(`/conversations/${id}/read/`, { method: "POST", body: { up_to_seq: upToSeq } }),
  edit: (messageId: string, body: string) => authed<Message>(`/messages/${messageId}/`, { method: "PATCH", body: { body } }),
  remove: (messageId: string, forEveryone: boolean) => authed<void>(`/messages/${messageId}/?for_everyone=${forEveryone}`, { method: "DELETE" }),
  react: (messageId: string, emoji: string) => authed<{ reacted: boolean }>(`/messages/${messageId}/reactions/`, { method: "POST", body: { emoji } }),
};
