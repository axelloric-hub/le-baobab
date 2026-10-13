/** Notifications (apps/notifications/api.py). */
import { authed, type Page } from "@/lib/api/authed";
import type { UserBrief } from "@/features/social/types";

export interface AppNotification {
  id: string;
  type: string;
  actor: UserBrief | null;
  target_type: string;
  target_id: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  types: Array<{ code: string; category: string; critical: boolean; default_channels?: string[] }>;
  preferences: Array<{ type: string | null; channel: string; enabled: boolean }>;
}

export const notificationsApi = {
  list: (unread: boolean, path?: string) => authed<Page<AppNotification>>(path ?? `/notifications/${unread ? "?unread=true" : ""}`),
  markRead: (ids?: string[]) => authed<{ marked: number }>("/notifications/read/", { method: "POST", body: ids ? { ids } : {} }),
  preferences: () => authed<NotificationPreferences>("/notifications/preferences/"),
  setPreference: (type: string | null, channel: string, enabled: boolean) =>
    authed<{ type: string | null; channel: string; enabled: boolean }>("/notifications/preferences/", { method: "PUT", body: { type, channel, enabled } }),
};
