import type { Status, UserBrief } from "@/features/social/types";

export interface StatusGroup {
  author: UserBrief;
  items: Status[];
  unseen: boolean;
  latest: string;
}

/** Statuts regroupés par auteur : non vus d'abord, puis les plus récents ; chaque groupe dans l'ordre chronologique. */
export function groupStatuses(statuses: Status[], me: string): { mine: StatusGroup | null; others: StatusGroup[] } {
  const byAuthor = new Map<string, StatusGroup>();
  for (const status of statuses) {
    const key = status.author.username;
    const group = byAuthor.get(key) ?? { author: status.author, items: [], unseen: false, latest: status.created_at };
    group.items.push(status);
    if (!status.viewed) group.unseen = true;
    if (status.created_at > group.latest) group.latest = status.created_at;
    byAuthor.set(key, group);
  }
  for (const group of byAuthor.values()) group.items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const mine = byAuthor.get(me) ?? null;
  byAuthor.delete(me);
  const others = [...byAuthor.values()].sort((a, b) => Number(b.unseen) - Number(a.unseen) || b.latest.localeCompare(a.latest));
  return { mine, others };
}

/** Fonds proposés pour un statut texte : uniquement des couleurs de la charte. */
export const STATUS_BACKGROUNDS = [
  { value: "#6f2c0e", label: "Brun baobab" },
  { value: "#2a140a", label: "Brun nuit" },
  { value: "#8a3a12", label: "Brun du logo" },
  { value: "#9a4a1f", label: "Latérite" },
  { value: "#2563eb", label: "Bleu" },
  { value: "#1f56d6", label: "Bleu profond" },
  { value: "#fbf8f3", label: "Ivoire" },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Fond sûr (le style vient du serveur, donc d'un autre client) : couleur hexadécimale uniquement. */
export function safeBackground(style: Status["style"]): string {
  const value = style?.background;
  return typeof value === "string" && HEX.test(value) ? value : STATUS_BACKGROUNDS[0].value;
}

/** Couleur de texte lisible sur le fond (contraste WCAG). */
export function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#2a140a" : "#ffffff";
}

/** Durée d'affichage d'un statut sans média (texte : temps de lecture). */
export function durationOf(status: Status): number {
  if (status.kind === "text") return Math.min(12_000, Math.max(5_000, 3_000 + status.body.length * 45));
  if (status.kind === "link") return 8_000;
  return 6_000;
}

export const STATUS_EMOJIS = ["👍", "❤️", "👏", "💡", "😄", "🔥"];
