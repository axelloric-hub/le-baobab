import type { MessageKind } from "@/features/messaging/types";

/** Libellé court d'un message sans texte (liste des conversations, citation). */
export function kindLabel(kind: MessageKind, attachments = 0): string {
  switch (kind) {
    case "image":
      return attachments > 1 ? `📷 ${attachments} photos` : "📷 Photo";
    case "video":
      return "🎥 Vidéo";
    case "audio":
      return "🎤 Audio";
    case "file":
      return attachments > 1 ? `📎 ${attachments} fichiers` : "📎 Fichier";
    case "code":
      return "💻 Code";
    default:
      return "";
  }
}

/** Heure « 14:32 » aujourd'hui, « hier », jour de la semaine cette semaine, sinon date courte. */
export function listTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return date.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "hier";
  if (days < 7) return date.toLocaleDateString("fr", { weekday: "short" });
  return date.toLocaleDateString("fr", { day: "numeric", month: "short" });
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return date.toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} Mo`;
}
