import type { OrderStatus, Product, ProductKind } from "@/features/shop/types";
import { formatMoney } from "@/lib/money";

export const KIND_LABELS: Record<ProductKind, string> = {
  application: "Application",
  software: "Logiciel",
  service: "Service",
  template: "Template",
  resource: "Ressource",
  course: "Formation",
  digital_content: "Contenu numérique",
};

export const KIND_HINTS: Record<ProductKind, string> = {
  application: "Application à télécharger : une version avec fichier est requise.",
  software: "Logiciel à télécharger : une version avec fichier est requise.",
  service: "Prestation (audit, développement, accompagnement) : pas de fichier ni de licence.",
  template: "Modèle, kit de démarrage, thème : fichiers et licence.",
  resource: "Ressource numérique : jeu de données, icônes, documentation…",
  course: "Accès payant à un cours, un module, un chapitre ou une classe Learn que vous enseignez.",
  digital_content: "Livre numérique, vidéo, audio…",
};

export const LICENSE_LABELS: Record<string, string> = {
  personal: "Licence personnelle",
  team: "Licence équipe",
  commercial: "Licence commerciale",
  none: "Sans licence",
};

export const STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "brown" }> = {
  draft: { label: "Brouillon", tone: "amber" },
  published: { label: "En vente", tone: "green" },
  suspended: { label: "Suspendu", tone: "red" },
  archived: { label: "Archivé", tone: "neutral" },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: "neutral" | "green" | "amber" | "red" | "brown" }> = {
  pending: { label: "En attente de paiement", tone: "amber" },
  paid: { label: "Payée", tone: "green" },
  cancelled: { label: "Annulée", tone: "neutral" },
  partially_refunded: { label: "Partiellement remboursée", tone: "brown" },
  refunded: { label: "Remboursée", tone: "neutral" },
};

export const PLATFORMS: Record<string, string> = {
  any: "Toutes plateformes",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
  web: "Web",
};

export const SCOPE_LABELS: Record<string, string> = { classroom: "Classe", course: "Cours", module: "Module", chapter: "Chapitre" };

/** Prix affiché : « Gratuit », « 5 000 FCFA » ou « dès 5 000 FCFA » selon les offres. */
export function priceOf(product: Pick<Product, "variants">): { text: string; free: boolean } | null {
  const prices = product.variants.filter((v) => v.is_active !== false);
  if (prices.length === 0) return null;
  const min = prices.reduce((a, b) => (b.price_minor < a.price_minor ? b : a));
  if (min.price_minor === 0) return { text: "Gratuit", free: true };
  const text = formatMoney(min.price_minor, min.currency);
  return { text: prices.some((v) => v.price_minor !== min.price_minor) ? `Dès ${text}` : text, free: false };
}

const SIZE = ["o", "Ko", "Mo", "Go"];
export function fileSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0).replace(".", ",")} ${SIZE[unit]}`;
}
