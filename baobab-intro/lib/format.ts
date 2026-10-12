/** Mise en forme française (dates relatives, nombres compacts). */
const RELATIVE = new Intl.RelativeTimeFormat("fr", { numeric: "auto", style: "short" });
const DATE = new Intl.DateTimeFormat("fr", { day: "numeric", month: "short" });
const DATE_YEAR = new Intl.DateTimeFormat("fr", { day: "numeric", month: "short", year: "numeric" });
const FULL = new Intl.DateTimeFormat("fr", { dateStyle: "full", timeStyle: "short" });
const COMPACT = new Intl.NumberFormat("fr", { notation: "compact", maximumFractionDigits: 1 });

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », puis la date. */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const date = new Date(iso);
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "à l'instant";
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return RELATIVE.format(Math.round(seconds / 86_400), "day");
  return (date.getFullYear() === new Date(now).getFullYear() ? DATE : DATE_YEAR).format(date);
}

export function fullDate(iso: string | null | undefined): string {
  return iso ? FULL.format(new Date(iso)) : "";
}

export function compactNumber(value: number): string {
  return value < 1000 ? String(value) : COMPACT.format(value);
}

/** Initiales pour les avatars sans photo (« Aminata Diallo » → « AD »). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function plural(count: number, one: string, many: string): string {
  return `${compactNumber(count)} ${count > 1 ? many : one}`;
}
