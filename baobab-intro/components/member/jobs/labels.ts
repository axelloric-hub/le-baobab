import type { ApplicationStatus, CompanyRole, ContractType, JobStatus, JobType, Level, Remote } from "@/features/jobs/types";

export const JOB_TYPES: Record<JobType, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  internship: "Stage",
  contract: "Mission",
  freelance: "Freelance",
};

export const CONTRACTS: Record<ContractType, string> = {
  permanent: "CDI",
  fixed_term: "CDD",
  freelance: "Freelance",
  internship: "Convention de stage",
};

/** Contrat cohérent avec chaque type (le serveur impose freelance ↔ freelance). */
export const CONTRACTS_FOR: Record<JobType, ContractType[]> = {
  full_time: ["permanent", "fixed_term"],
  part_time: ["permanent", "fixed_term"],
  internship: ["internship"],
  contract: ["fixed_term", "freelance"],
  freelance: ["freelance"],
};

export const LEVELS: Record<Level, string> = { junior: "Junior", mid: "Confirmé", senior: "Senior", lead: "Lead" };

export const REMOTE: Record<Remote, string> = { onsite: "Sur site", hybrid: "Hybride", remote: "Télétravail" };

export const JOB_STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  open: { label: "Ouverte", tone: "green" },
  paused: { label: "En pause", tone: "amber" },
  closed: { label: "Fermée", tone: "neutral" },
  filled: { label: "Pourvue", tone: "blue" },
};

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "brown";

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: Tone; hint: string }> = {
  submitted: { label: "Envoyée", tone: "neutral", hint: "Votre candidature a bien été reçue." },
  reviewing: { label: "En cours d'examen", tone: "blue", hint: "Le recruteur étudie votre candidature." },
  shortlisted: { label: "Présélectionnée", tone: "brown", hint: "Bonne nouvelle : réservez un créneau d'entretien." },
  interview: { label: "Entretien", tone: "brown", hint: "Votre entretien est planifié." },
  offer: { label: "Offre reçue", tone: "green", hint: "Une offre vous attend : acceptez-la ou refusez-la." },
  hired: { label: "Embauché(e)", tone: "green", hint: "Félicitations, l'offre est acceptée." },
  rejected: { label: "Non retenue", tone: "red", hint: "Le recruteur n'a pas retenu cette candidature." },
  withdrawn: { label: "Retirée", tone: "neutral", hint: "Cette candidature a été retirée." },
};

/** Étapes principales, dans l'ordre (frise de suivi). */
export const PIPELINE: ApplicationStatus[] = ["submitted", "reviewing", "shortlisted", "interview", "offer", "hired"];

/** Transitions offertes au recruteur depuis chaque étape (miroir de la matrice du serveur ; « offer » passe par l'envoi d'une offre). */
export const RECRUITER_NEXT: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  submitted: ["reviewing", "rejected"],
  reviewing: ["shortlisted", "rejected"],
  shortlisted: ["interview", "rejected"],
  interview: ["rejected"],
  offer: ["rejected"],
};

export const TRANSITION_LABELS: Partial<Record<ApplicationStatus, string>> = {
  reviewing: "Examiner",
  shortlisted: "Présélectionner",
  interview: "Passer en entretien",
  rejected: "Ne pas retenir",
};

export const PROPOSAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  submitted: { label: "Envoyée", tone: "neutral" },
  accepted: { label: "Acceptée", tone: "green" },
  rejected: { label: "Non retenue", tone: "red" },
  withdrawn: { label: "Retirée", tone: "neutral" },
};

export const INTERVIEW_MODES: Record<string, string> = { video: "Visio", phone: "Téléphone", onsite: "Sur place" };

export const MILESTONE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "À faire", tone: "neutral" },
  in_progress: { label: "En cours", tone: "blue" },
  submitted: { label: "Livré", tone: "amber" },
  approved: { label: "Validé", tone: "green" },
};

export const CONTRACT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "En cours", tone: "blue" },
  completed: { label: "Terminé", tone: "green" },
  terminated: { label: "Résilié", tone: "red" },
};

export const COMPANY_ROLES: Record<CompanyRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  recruiter: "Recruteur",
  editor: "Éditeur",
  employee: "Employé",
};

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export const RECRUITER_ROLES: CompanyRole[] = ["owner", "admin", "recruiter"];
