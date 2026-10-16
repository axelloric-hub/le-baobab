/** Showcase : vitrine des projets des portfolios (apps/portfolio). */
import type { UserBrief } from "@/features/social/types";

export interface Technology {
  slug: string;
  name: string;
}

export interface ShowcaseProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  role: string;
  started_on: string | null;
  ended_on: string | null;
  is_featured: boolean;
  technologies: Technology[];
  links: Array<{ id: string; kind: "demo" | "repository" | "article" | "other"; provider: string; url: string }>;
  media: Array<{ id: string; kind: string; url: string }>;
  owner: UserBrief;
  created_at: string;
}

export interface ShowcaseProjectDetail extends ShowcaseProject {
  is_mine: boolean;
  repositories: Array<{ id: string; provider: string; full_name: string; url: string; description: string; language: string; stars: number; verified: boolean }>;
  more: ShowcaseProject[];
}

export interface ProjectInput {
  title?: string;
  description?: string;
  role?: string;
  started_on?: string | null;
  ended_on?: string | null;
  is_featured?: boolean;
  technologies?: string[];
}

export interface ShowcaseFilters {
  q?: string;
  tech?: string;
  featured?: string;
  user?: string;
}
