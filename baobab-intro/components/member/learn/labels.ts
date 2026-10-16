import type { AccessReason, BlockKind, ClassroomPrivacy, CourseLevel } from "@/features/learn/types";

export const LEVELS: Record<CourseLevel, string> = { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé" };

export const LANGUAGES: Record<string, string> = { fr: "Français", en: "Anglais", ar: "Arabe", pt: "Portugais", sw: "Swahili", wo: "Wolof" };

export const CLASSROOM_PRIVACY: Record<ClassroomPrivacy, { label: string; hint: string }> = {
  public: { label: "Publique", hint: "Visible de tous ; chacun peut rejoindre et suivre ses cours publiés." },
  private: { label: "Privée", hint: "Invisible hors membres : les enseignants invitent les élèves et valident les demandes." },
  invite_only: { label: "Sur invitation", hint: "Invisible hors membres : seules les personnes invitées peuvent entrer." },
};

export const ROLE_LABELS: Record<string, string> = { owner: "Responsable", instructor: "Enseignant", assistant: "Assistant", student: "Élève", lead: "Enseignant principal" };

/** Ce qui empêche d'ouvrir un chapitre, et ce qu'il faut faire. */
export const ACCESS: Record<AccessReason, string> = {
  ok: "",
  not_published: "Ce chapitre n'est pas encore publié.",
  membership_required: "Rejoignez d'abord la classe.",
  classroom_payment_required: "L'accès à cette classe est payant.",
  enroll_required: "Inscrivez-vous au cours pour ouvrir ce chapitre.",
  payment_required: "Ce chapitre est payant.",
};

export const BLOCK_KINDS: Partial<Record<BlockKind, string>> = {
  text: "Texte",
  code: "Code",
  video: "Vidéo",
  image: "Image",
  audio: "Audio",
  pdf: "PDF",
  document: "Document",
  presentation: "Présentation",
  notebook: "Notebook",
  link: "Lien",
  repository: "Dépôt GitHub",
  quiz: "Quiz",
};

/** « 1 h 25 », « 45 min ». */
export function duration(minutes: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}
