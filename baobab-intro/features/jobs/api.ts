/** Couche service : offres, candidatures, entretiens, propositions, contrats, entreprises. Une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type {
  Application,
  ApplicationStatus,
  ApplyInput,
  Company,
  CompanyInput,
  CompanyMember,
  Contract,
  HiringOffer,
  Job,
  JobInput,
  MyCompany,
  Proposal,
  Slot,
} from "./types";

export interface JobFilters {
  q?: string;
  type?: string;
  remote?: string;
  level?: string;
  country?: string;
  skill?: string;
  company?: string;
}

const j = (id: string) => `/jobs/${id}`;
const co = (slug: string) => `/companies/${encodeURIComponent(slug)}`;

export const jobsApi = {
  list: (filters: JobFilters, path?: string) => {
    if (path) return authed<Page<Job>>(path);
    const query = new URLSearchParams({ limit: "20" });
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return authed<Page<Job>>(`/jobs/?${query}`);
  },
  mine: (path?: string) => authed<Page<Job>>(path ?? "/me/jobs/?limit=50"),
  detail: (id: string) => authed<Job>(`${j(id)}/`),
  create: (input: JobInput) => authed<Job>("/jobs/", { method: "POST", body: input }),
  update: (id: string, input: Partial<JobInput>) => authed<Job>(`${j(id)}/`, { method: "PATCH", body: input }),
  publish: (id: string) => authed<Job>(`${j(id)}/publish/`, { method: "POST", body: {} }),
  close: (id: string, filled: boolean) => authed<Job>(`${j(id)}/close/`, { method: "POST", body: { filled } }),

  apply: (id: string, input: ApplyInput) => authed<Application>(`${j(id)}/apply/`, { method: "POST", body: input }),
  myApplications: (path?: string) => authed<Page<Application>>(path ?? "/me/applications/"),
  application: (id: string) => authed<Application>(`/applications/${id}/`),
  jobApplications: (id: string, status?: string, path?: string) =>
    authed<Page<Application>>(path ?? `${j(id)}/applications/${status ? `?status=${status}` : ""}`),
  transition: (id: string, to: ApplicationStatus, note = "") =>
    authed<Application>(`/applications/${id}/transition/`, { method: "POST", body: { to_status: to, note } }),

  slots: (id: string) => authed<Slot[]>(`${j(id)}/slots/`),
  createSlot: (id: string, starts_at: string, ends_at: string) => authed<Slot>(`${j(id)}/slots/`, { method: "POST", body: { starts_at, ends_at } }),
  book: (applicationId: string, slot: string, mode: string, location: string) =>
    authed<{ id: string; status: string }>(`/applications/${applicationId}/book/`, { method: "POST", body: { slot, mode, location } }),
  makeOffer: (applicationId: string, input: { amount_minor: number; currency: string; period: string; start_date?: string; valid_days: number }) =>
    authed<HiringOffer>(`/applications/${applicationId}/offer/`, { method: "POST", body: input }),
  myOffers: () => authed<Array<HiringOffer & { job: string; job_id: string; application: string }>>("/me/offers/"),
  respondOffer: (id: string, accept: boolean) => authed<{ status: string }>(`/offers/${id}/respond/`, { method: "POST", body: { accept } }),

  propose: (id: string, input: { cover_letter: string; bid_minor: number; currency: string; delivery_days: number }) =>
    authed<{ id: string; status: string }>(`${j(id)}/proposals/`, { method: "POST", body: input }),
  jobProposals: (id: string, path?: string) => authed<Page<Proposal>>(path ?? `${j(id)}/proposals/`),
  myProposals: () => authed<Proposal[]>("/me/proposals/"),
  acceptProposal: (id: string) => authed<Contract>(`/proposals/${id}/accept/`, { method: "POST", body: {} }),

  contracts: (path?: string) => authed<Page<Contract>>(path ?? "/me/contracts/"),
  advanceMilestone: (id: string, action: "start" | "submit" | "approve") => authed<{ status: string }>(`/milestones/${id}/advance/`, { method: "POST", body: { action } }),
  terminateContract: (id: string) => authed<{ status: string }>(`/contracts/${id}/terminate/`, { method: "POST", body: {} }),

  myCompanies: () => authed<MyCompany[]>("/me/companies/"),
  company: (slug: string) => authed<Company>(`${co(slug)}/`),
  companyMembers: (slug: string) => authed<CompanyMember[]>(`${co(slug)}/members/`),
  createCompany: (input: CompanyInput) => authed<Company>("/companies/", { method: "POST", body: input }),
  updateCompany: (slug: string, input: CompanyInput) => authed<Company>(`${co(slug)}/`, { method: "PATCH", body: input }),
  addCompanyMember: (slug: string, username: string, role: string, title: string) =>
    authed(`${co(slug)}/members/`, { method: "POST", body: { username, role, title } }),
  removeCompanyMember: (slug: string, username: string) => authed<void>(`${co(slug)}/members/${encodeURIComponent(username)}/`, { method: "DELETE" }),
  addCompanyLink: (slug: string, provider: string, url: string) => authed(`${co(slug)}/links/`, { method: "POST", body: { provider, url } }),
};
