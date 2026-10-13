/** Profils et relations (apps/profiles, apps/friends, apps/portfolio). */
import type { UserBrief } from "@/features/social/types";

export type Availability = "none" | "open_to_work" | "freelance" | "hiring";

export interface ProfileSkill {
  slug: string;
  name: string;
  level: number;
  years_experience: number | null;
}

export interface ProfileLink {
  id: string;
  provider: string;
  url: string;
  handle: string;
}

export interface Relation {
  is_friend: boolean;
  is_following: boolean;
  follows_me: boolean;
  friend_request: { id: string; direction: "sent" | "received" } | null;
  is_close_friend: boolean;
}

export interface Profile extends UserBrief {
  headline: string;
  bio: string;
  cover_url: string | null;
  country: { code: string; name: string } | null;
  region: string;
  city: string;
  languages: string[];
  profession: { slug: string; name: string } | null;
  availability: Availability;
  is_verified: boolean;
  skills: ProfileSkill[];
  interests: string[];
  links: ProfileLink[];
  stats?: { posts: number; followers: number; following: number; friends: number };
  joined_at?: string;
  relation?: Relation;
}

export interface PortfolioProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  role: string;
  started_on: string | null;
  ended_on: string | null;
  is_featured: boolean;
  technologies: string[];
  links: Array<{ kind: string; provider: string; url: string }>;
  media: Array<{ kind: string; url: string }>;
}

export interface Portfolio {
  owner: UserBrief;
  title: string;
  summary: string;
  visibility: string;
  projects: PortfolioProject[];
  repositories: Array<{ id: string; provider: string; full_name: string; url: string; description: string; language: string; stars: number | null; verified: boolean; owner_verified: boolean }>;
  experiences: Array<{ id: string; company_name: string; title: string; location: string; started_on: string; ended_on: string | null; description: string }>;
  educations: Array<{ id: string; institution: string; degree: string; field: string; started_on: string | null; ended_on: string | null }>;
  achievements: Array<{ id: string; title: string; issuer: string; achieved_on: string | null; url: string }>;
  certificates: Array<{ id: string; name: string; issuer: string; issued_on: string | null; credential_url: string; verified_by_platform: boolean }>;
}

export interface FriendRequestIn {
  id: string;
  from: UserBrief;
  created_at: string;
}
