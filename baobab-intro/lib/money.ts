/**
 * Montants d'argent : l'API les donne en ENTIERS dans la plus petite unité de la devise
 * (XAF, XOF : 1 franc ; EUR, USD : 1 centime). Le nombre de décimales vient d'Intl, jamais d'une liste figée.
 */

/** Devises proposées dans les formulaires (francs CFA d'abord : public principal de LE BAOBAB). */
export const CURRENCIES = ["XAF", "XOF", "NGN", "GHS", "KES", "MAD", "ZAR", "EUR", "USD"] as const;

const digitsCache = new Map<string, number>();

/** Décimales de la devise (XAF → 0, EUR → 2). */
export function currencyDigits(currency: string): number {
  const code = (currency || "XAF").toUpperCase();
  let digits = digitsCache.get(code);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("fr", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    digitsCache.set(code, digits);
  }
  return digits;
}

/** 150000 XAF (unités mineures) → « 150 000 FCFA » ; 1999 EUR → « 19,99 € ». */
export function formatMoney(minor: number | null | undefined, currency: string, options: { compact?: boolean } = {}): string {
  if (minor === null || minor === undefined) return "";
  const code = (currency || "XAF").toUpperCase();
  const value = minor / 10 ** currencyDigits(code);
  try {
    return new Intl.NumberFormat("fr", {
      style: "currency",
      currency: code,
      notation: options.compact && value >= 100_000 ? "compact" : "standard",
      maximumFractionDigits: options.compact ? 1 : currencyDigits(code),
    }).format(value);
  } catch {
    return `${value} ${code}`;
  }
}

/** Saisie de l'utilisateur (« 150 000 », « 19,99 ») → unités mineures ; null si invalide. */
export function toMinor(input: string, currency: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 10 ** currencyDigits(currency));
  return Number.isFinite(minor) ? minor : null;
}

/** Unités mineures → valeur à afficher dans un champ de saisie (« 19,99 »). */
export function toInput(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined) return "";
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits).replace(".", ",");
}

export const PERIOD_LABELS: Record<string, string> = { hour: "heure", day: "jour", month: "mois", year: "an" };

/** « 300 000 – 500 000 FCFA / mois ». */
export function formatSalary(salary: { min_minor: number; max_minor: number; currency: string; period: string } | null | undefined): string {
  if (!salary) return "";
  const period = PERIOD_LABELS[salary.period] ? ` / ${PERIOD_LABELS[salary.period]}` : "";
  if (salary.min_minor === salary.max_minor) return `${formatMoney(salary.min_minor, salary.currency)}${period}`;
  const min = formatMoney(salary.min_minor, salary.currency).replace(/\s?[^\d\s,.  ]+$/u, "").trim();
  return `${min} – ${formatMoney(salary.max_minor, salary.currency)}${period}`;
}
