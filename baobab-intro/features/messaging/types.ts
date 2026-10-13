/** Formes des réponses de la messagerie (apps/messaging/api.py). */
import type { UserBrief } from "@/features/social/types";

export interface Conversation {
  id: string;
  type: "direct" | "group";
  title: string;
  /** Conversation directe : l'autre personne ; « online » seulement si elle l'autorise. */
  with: (UserBrief & { online?: boolean }) | null;
  unread: number;
  last_message_at: string | null;
  last_read_seq: number;
  message_seq: number;
  last_message?: MessagePreview | null;
  /** Conversation directe : jusqu'où l'autre a lu (null si l'un des deux masque ses accusés de lecture). */
  others_read_seq?: number | null;
}

export interface MessagePreview {
  id: string;
  seq: number;
  kind: MessageKind;
  body: string;
  sender: string | null;
  sender_name: string | null;
  attachments: number;
  created_at: string;
}

export type MessageKind = "text" | "image" | "video" | "audio" | "file" | "code" | "system";

export interface Attachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface Message {
  id: string;
  seq: number;
  sender: UserBrief | null;
  kind: MessageKind;
  body: string;
  metadata: Record<string, unknown>;
  reply_to: string | null;
  thread_root: string | null;
  reply_count: number;
  edited_at: string | null;
  created_at: string;
  attachments: Attachment[];
  reactions: Record<string, number>;
  my_reactions?: string[];
  /** Côté client uniquement : envoi en cours ou échoué (interface optimiste). */
  local?: { state: "sending" | "failed"; clientId: string; input: SendInput };
}

export interface SendInput {
  body: string;
  kind?: MessageKind;
  reply_to?: string;
  client_msg_id: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}
