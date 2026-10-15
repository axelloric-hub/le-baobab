"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import { useDebounced } from "@/features/people/hooks";
import { jobsApi, type JobFilters } from "./api";
import type { Application, ApplicationStatus, ApplyInput, CompanyInput, Contract, Job, JobInput, Proposal } from "./types";

export const jobKeys = {
  all: ["jobs"] as const,
  list: (filters: JobFilters) => ["jobs", "list", filters] as const,
  mine: ["jobs", "mine"] as const,
  detail: (id: string) => ["job", id] as const,
  applicationsOf: (id: string) => ["job", id, "applications"] as const,
  applicationsOfStatus: (id: string, status: string) => ["job", id, "applications", status] as const,
  slots: (id: string) => ["job", id, "slots"] as const,
  proposalsOf: (id: string) => ["job", id, "proposals"] as const,
  myApplications: ["applications", "mine"] as const,
  application: (id: string) => ["application", id] as const,
  myProposals: ["proposals", "mine"] as const,
  myOffers: ["offers", "mine"] as const,
  contracts: ["contracts"] as const,
  myCompanies: ["companies", "mine"] as const,
  company: (slug: string) => ["company", slug] as const,
  companyMembers: (slug: string) => ["company", slug, "members"] as const,
};

function usePaged<T>(key: readonly unknown[], first: () => Promise<Page<T>>, next: (path: string) => Promise<Page<T>>, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => (pageParam ? next(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<T>) => nextPath(last.next),
    enabled,
    staleTime: 30_000,
  });
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export function useJobs(filters: JobFilters) {
  const q = useDebounced(filters.q?.trim() ?? "");
  const effective = { ...filters, q: q.length >= 2 ? q : "" };
  return usePaged<Job>(jobKeys.list(effective), () => jobsApi.list(effective), (path) => jobsApi.list({}, path));
}

export const useMyJobs = (enabled = true) => usePaged<Job>(jobKeys.mine, () => jobsApi.mine(), (path) => jobsApi.mine(path), enabled);

export function useJob(id: string) {
  return useQuery({ queryKey: jobKeys.detail(id), queryFn: () => jobsApi.detail(id), staleTime: 30_000 });
}

export const useMyApplications = () => usePaged<Application>(jobKeys.myApplications, () => jobsApi.myApplications(), (path) => jobsApi.myApplications(path));

export function useApplication(id: string | null | undefined) {
  return useQuery({ queryKey: jobKeys.application(id ?? ""), queryFn: () => jobsApi.application(id!), enabled: Boolean(id), staleTime: 15_000 });
}

export function useJobApplications(id: string, status: string, enabled: boolean) {
  return usePaged<Application>(
    jobKeys.applicationsOfStatus(id, status),
    () => jobsApi.jobApplications(id, status || undefined),
    (path) => jobsApi.jobApplications(id, undefined, path),
    enabled,
  );
}

export function useSlots(id: string, enabled: boolean) {
  return useQuery({ queryKey: jobKeys.slots(id), queryFn: () => jobsApi.slots(id), enabled, staleTime: 15_000 });
}

export function useJobProposals(id: string, enabled: boolean) {
  return usePaged<Proposal>(jobKeys.proposalsOf(id), () => jobsApi.jobProposals(id), (path) => jobsApi.jobProposals(id, path), enabled);
}

export function useMyProposals() {
  return useQuery({ queryKey: jobKeys.myProposals, queryFn: jobsApi.myProposals, staleTime: 30_000 });
}

export function useContracts() {
  return usePaged<Contract>(jobKeys.contracts, () => jobsApi.contracts(), (path) => jobsApi.contracts(path));
}

export function useMyCompanies() {
  return useQuery({ queryKey: jobKeys.myCompanies, queryFn: jobsApi.myCompanies, staleTime: 5 * 60_000 });
}

export function useCompany(slug: string) {
  return useQuery({ queryKey: jobKeys.company(slug), queryFn: () => jobsApi.company(slug), staleTime: 60_000 });
}

export function useCompanyMembers(slug: string) {
  return useQuery({ queryKey: jobKeys.companyMembers(slug), queryFn: () => jobsApi.companyMembers(slug), staleTime: 60_000 });
}

/* ------------------------------------------------------------------ */
/* Écritures                                                           */
/* ------------------------------------------------------------------ */

/** Une offre a changé : on met à jour son détail et on relit les listes. */
function useJobChanged() {
  const client = useQueryClient();
  return (job: Job) => {
    client.setQueryData(jobKeys.detail(job.id), job);
    void client.invalidateQueries({ queryKey: jobKeys.all });
  };
}

export function useSaveJob(id?: string) {
  const changed = useJobChanged();
  return useMutation({
    mutationFn: (input: JobInput) => (id ? jobsApi.update(id, input) : jobsApi.create(input)),
    onSuccess: changed,
  });
}

export function useJobStatus(id: string) {
  const changed = useJobChanged();
  return useMutation({
    mutationFn: (action: "publish" | "close" | "fill") => (action === "publish" ? jobsApi.publish(id) : jobsApi.close(id, action === "fill")),
    onSuccess: changed,
  });
}

/** Candidater : l'offre affiche aussitôt « Candidature envoyée ». */
export function useApply(job: Job) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyInput) => jobsApi.apply(job.id, input),
    onSuccess: (application) => {
      client.setQueryData<Job>(jobKeys.detail(job.id), (j) => (j && j.viewer ? { ...j, viewer: { ...j.viewer, application: { id: application.id, status: application.status } } } : j));
      client.setQueryData(jobKeys.application(application.id), application);
      void client.invalidateQueries({ queryKey: jobKeys.myApplications });
      void client.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

export function usePropose(job: Job) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { cover_letter: string; bid_minor: number; currency: string; delivery_days: number }) => jobsApi.propose(job.id, input),
    onSuccess: (proposal) => {
      client.setQueryData<Job>(jobKeys.detail(job.id), (j) => (j && j.viewer ? { ...j, viewer: { ...j.viewer, proposal: { id: proposal.id, status: proposal.status } } } : j));
      void client.invalidateQueries({ queryKey: jobKeys.myProposals });
    },
  });
}

/** Changement d'étape d'une candidature (recruteur ou retrait par le candidat). */
export function useTransition(jobId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, note }: { id: string; to: ApplicationStatus; note?: string }) => jobsApi.transition(id, to, note),
    onSuccess: (application) => {
      client.setQueryData(jobKeys.application(application.id), application);
      client.setQueryData<Job>(jobKeys.detail(jobId), (j) =>
        j?.viewer?.application?.id === application.id ? { ...j, viewer: { ...j.viewer, application: { id: application.id, status: application.status } } } : j,
      );
      void client.invalidateQueries({ queryKey: jobKeys.applicationsOf(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.myApplications });
      void client.invalidateQueries({ queryKey: jobKeys.mine });
    },
  });
}

export function useCreateSlot(jobId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ starts_at, ends_at }: { starts_at: string; ends_at: string }) => jobsApi.createSlot(jobId, starts_at, ends_at),
    onSuccess: () => void client.invalidateQueries({ queryKey: jobKeys.slots(jobId) }),
  });
}

export function useBook(jobId: string, applicationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ slot, mode, location }: { slot: string; mode: string; location: string }) => jobsApi.book(applicationId, slot, mode, location),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: jobKeys.application(applicationId) });
      void client.invalidateQueries({ queryKey: jobKeys.slots(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.applicationsOf(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.myApplications });
    },
  });
}

export function useMakeOffer(jobId: string, applicationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount_minor: number; currency: string; period: string; start_date?: string; valid_days: number }) => jobsApi.makeOffer(applicationId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: jobKeys.application(applicationId) });
      void client.invalidateQueries({ queryKey: jobKeys.applicationsOf(jobId) });
    },
  });
}

export function useRespondOffer(jobId: string, applicationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => jobsApi.respondOffer(id, accept),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: jobKeys.application(applicationId) });
      void client.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.myApplications });
      void client.invalidateQueries({ queryKey: jobKeys.contracts });
    },
  });
}

export function useAcceptProposal(jobId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jobsApi.acceptProposal(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: jobKeys.proposalsOf(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      void client.invalidateQueries({ queryKey: jobKeys.mine });
      void client.invalidateQueries({ queryKey: jobKeys.contracts });
    },
  });
}

export function useMilestone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "submit" | "approve" }) => jobsApi.advanceMilestone(id, action),
    onSuccess: () => void client.invalidateQueries({ queryKey: jobKeys.contracts }),
  });
}

export function useSaveCompany(slug?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanyInput) => (slug ? jobsApi.updateCompany(slug, input) : jobsApi.createCompany(input)),
    onSuccess: (company) => {
      client.setQueryData(jobKeys.company(company.slug), company);
      void client.invalidateQueries({ queryKey: jobKeys.myCompanies });
    },
  });
}

export function useCompanyTeam(slug: string) {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: jobKeys.companyMembers(slug) });
  return {
    add: useMutation({ mutationFn: (m: { username: string; role: string; title: string }) => jobsApi.addCompanyMember(slug, m.username, m.role, m.title), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (username: string) => jobsApi.removeCompanyMember(slug, username), onSuccess: refresh }),
  };
}
