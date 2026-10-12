import type { ReactionType } from "@/features/social/types";

/** Les 6 réactions du backend (apps/social/models.py : ReactionType), dans l'ordre d'affichage. */
export const REACTIONS: Array<{ type: ReactionType; emoji: string; label: string; color: string }> = [
  { type: "like", emoji: "👍", label: "J'aime", color: "#2563eb" },
  { type: "love", emoji: "❤️", label: "J'adore", color: "#e11d48" },
  { type: "celebrate", emoji: "👏", label: "Bravo", color: "#d97706" },
  { type: "insightful", emoji: "💡", label: "Instructif", color: "#0d9488" },
  { type: "funny", emoji: "😄", label: "Drôle", color: "#ca8a04" },
  { type: "support", emoji: "🤝", label: "Soutien", color: "#7c3aed" },
];

export const reactionOf = (type: ReactionType | null | undefined) => REACTIONS.find((r) => r.type === type) ?? null;
