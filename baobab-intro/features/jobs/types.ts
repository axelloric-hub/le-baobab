/** Emplois, missions freelance, candidatures, entretiens, offres d'embauche, contrats (apps/jobs) et entreprises (apps/companies). */
import type { UserBrief } from "@/features/social/types";

export type JobType = "full_time" | "part_time" | "internship" | "contract" | "freelance";
export type ContractType = "permanent" | "fixed_term" | "freelance" | "internship";
export type Level = "junior" | "mid" | "senior" | "lead";
export type Remote = "onsite" | "hybrid" | "remote";
export type JobStatus = "draft" | "open" | "paused" | "closed" | "filled";
export type Period = "hour" | "day" | "month" | "year";
export type ApplicationStatus = "submitted" | "reviewing" | "shortlisted" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";

export interface Salary {
  min_minor: number;
  max_minor: number;
  currency: string;
  period: Period;
}

export interface CompanyBrief {
  slug: string;
  name: string;
  logo_url: string | null;
  verified?: boolean;
}

/** État propre au lecteur (absent pour un visiteur anonyme). */
export interface JobViewer {
  can_manage: boolean;
  application: { id: string; status: ApplicationStatus } | null;
  proposal: { id: string; status: string } | null;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  company: CompanyBrief | null;
  posted_by: UserBrief;
  job_type: JobType;
  contract_type: ContractType;
  experience_level: Level;
  remote_policy: Remote;
  country: string | null;
  country_name: string | null;
  city: string;
  salary: Salary | null;
  skills: Array<{ slug: string; name: string; required: boolean }>;
  status: JobStatus;
  published_at: string | null;
  deadline: string | null;
  created_at: string;
  viewer: JobViewer | null;
  /** /me/jobs/ uniquement. */
  counts?: { applications: number; new_applications: number; proposals: number };
}

export interface JobInput {
  company?: string;
  title: string;
  description: string;
  job_type: JobType;
  contract_type: ContractType;
  experience_level: Level;
  remote_policy: Remote;
  country?: string | null;
  city?: string;
  salary?: { min: number; max: number; currency: string; period: Period } | null;
  skills: Array<{ slug: string; required: boolean }>;
  deadline?: string | null;
}

export interface Interview {
  id: string;
  mode: "video" | "phone" | "onsite";
  location: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  starts_at: string | null;
  ends_at: string | null;
}

export interface HiringOffer {
  id: string;
  amount_minor: number;
  currency: string;
  period: Period;
  start_date: string | null;
  expires_at: string | null;
  status: "sent" | "accepted" | "declined" | "withdrawn";
}

export interface Application {
  id: string;
  job: { id: string; title: string; job_type: JobType; status: JobStatus; company: CompanyBrief | null };
  status: ApplicationStatus;
  cover_letter: string;
  portfolio_url: string;
  github_url: string;
  gitlab_url: string;
  cv_url: string | null;
  available_from: string | null;
  created_at: string;
  projects: Array<{ id: string; title: string }>;
  history: Array<{ from: string; to: ApplicationStatus; note: string; at: string }>;
  interviews: Interview[];
  offer: HiringOffer | null;
  /** Vue recruteur uniquement. */
  applicant?: UserBrief;
  expected_salary_minor?: number | null;
}

export interface ApplyInput {
  cover_letter?: string;
  cv_file?: string;
  portfolio_url?: string;
  github_url?: string;
  gitlab_url?: string;
  projects?: string[];
  expected_salary_minor?: number;
  available_from?: string;
}

export interface Slot {
  id: string;
  starts_at: string;
  ends_at: string;
  booked: boolean;
}

export interface Proposal {
  id: string;
  freelancer?: UserBrief;
  job?: { id: string; title: string; status: JobStatus };
  cover_letter: string;
  bid_minor: number;
  currency: string;
  delivery_days: number;
  status: "submitted" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
}

export interface Milestone {
  id: string;
  position: number;
  title: string;
  amount_minor: number;
  due_on: string | null;
  status: string;
}

export interface Contract {
  id: string;
  kind: "employment" | "freelance";
  title: string;
  client: UserBrief;
  contractor: UserBrief;
  amount_minor: number;
  currency: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  milestones: Milestone[];
}

export interface MyCompany {
  slug: string;
  name: string;
  role: CompanyRole;
  logo_url: string | null;
  verified: boolean;
}

export type CompanyRole = "owner" | "admin" | "recruiter" | "editor" | "employee";

export interface Company {
  slug: string;
  name: string;
  my_role: CompanyRole | null;
  created_at: string;
  tagline: string;
  description: string;
  website: string;
  industry: string;
  size_range: string;
  city: string;
  country: string | null;
  country_name: string | null;
  logo_url: string | null;
  cover_url: string | null;
  verified: boolean;
  links: Array<{ provider: string; url: string }>;
  projects: Array<{ title: string; description: string; url: string; repo_url: string }>;
  services: Array<{ title: string; description: string; starting_price_minor: number | null; currency: string }>;
}

export interface CompanyMember extends UserBrief {
  title: string;
  role: CompanyRole;
}

export interface CompanyInput {
  name?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  website?: string;
  industry?: string;
  size_range?: string;
  city?: string;
  country?: string | null;
  logo_file?: string | null;
  cover_file?: string | null;
}
