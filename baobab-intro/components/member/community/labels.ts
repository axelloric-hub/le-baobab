import type { GroupPrivacy, JoinPolicy } from "@/features/community/types";

export const PRIVACY: Record<GroupPrivacy, { label: string; hint: string }> = {
  public: { label: "Public", hint: "Tout le monde peut trouver le groupe et lire ses publications publiques." },
  private: { label: "Privé", hint: "Tout le monde peut trouver le groupe ; seuls les membres voient ses publications." },
  hidden: { label: "Secret", hint: "Invisible hors membres : on n'y entre que sur invitation." },
};

export const JOIN_POLICY: Record<JoinPolicy, { label: string; hint: string }> = {
  open: { label: "Ouvert", hint: "Chacun rejoint le groupe en un clic." },
  approval: { label: "Sur approbation", hint: "Les demandes sont validées par les modérateurs." },
  invite_only: { label: "Sur invitation", hint: "Seules les personnes invitées peuvent entrer." },
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  moderator: "Modérateur",
  member: "Membre",
};

export const roleLabel = (role: string | null | undefined) => (role ? (ROLE_LABELS[role] ?? role) : "");

/** Durées proposées pour mettre un membre en sourdine (minutes, max serveur : 30 jours). */
export const MUTE_DURATIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 60, label: "1 heure" },
  { minutes: 24 * 60, label: "24 heures" },
  { minutes: 7 * 24 * 60, label: "7 jours" },
  { minutes: 30 * 24 * 60, label: "30 jours" },
];
