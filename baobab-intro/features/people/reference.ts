"use client";

import { useQuery } from "@tanstack/react-query";
import { authed } from "@/lib/api/authed";

export interface RefItem {
  slug: string;
  name: string;
  region?: string;
  is_african?: boolean;
}

/** Référentiels (compétences, pays, métiers) : publics, stables, mis en cache pour la session. */
export function useReference(kind: "skills" | "countries" | "professions" | "interests", q = "") {
  return useQuery({
    queryKey: ["ref", kind, q],
    queryFn: () => authed<RefItem[]>(`/${kind}/${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    staleTime: Infinity,
  });
}

/** Libellés des compétences par slug (pour les technologies des projets). */
export function useSkillNames() {
  const skills = useReference("skills");
  return (slug: string) => skills.data?.find((s) => s.slug === slug)?.name ?? slug;
}

export const SKILL_LEVELS = ["Débutant", "Intermédiaire", "Confirmé", "Avancé", "Expert"];
export const LEVEL_COLORS = ["#9a4a1f", "#8a3a12", "#6f2c0e", "#1f56d6", "#2563eb"];

export const AVAILABILITY_LABELS: Record<string, string> = {
  open_to_work: "Ouvert aux opportunités",
  freelance: "Disponible pour des missions",
  hiring: "Recrute",
};

export const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  website: "Site web",
  portfolio: "Portfolio",
};
