"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed, nextPath, type Page } from "@/lib/api/authed";
import { useDebounced } from "@/features/people/hooks";
import { showcaseApi } from "./api";
import type { ProjectInput, ShowcaseFilters, ShowcaseProject } from "./types";

export const showcaseKeys = {
  list: (filters: ShowcaseFilters) => ["showcase", "projects", filters] as const,
  technologies: ["showcase", "technologies"] as const,
  project: (id: string) => ["showcase", "project", id] as const,
};

export function useShowcase(filters: ShowcaseFilters, enabled = true) {
  const q = useDebounced(filters.q?.trim() ?? "");
  const effective = { ...filters, q: q.length >= 2 ? q : "" };
  return useInfiniteQuery({
    queryKey: showcaseKeys.list(effective),
    queryFn: ({ pageParam }) => showcaseApi.projects(effective, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<ShowcaseProject>) => nextPath(last.next),
    enabled,
    staleTime: 30_000,
  });
}

export function useShowcaseTechnologies() {
  return useQuery({ queryKey: showcaseKeys.technologies, queryFn: showcaseApi.technologies, staleTime: 5 * 60_000 });
}

export function useShowcaseProject(id: string) {
  return useQuery({ queryKey: showcaseKeys.project(id), queryFn: () => showcaseApi.project(id), staleTime: 30_000 });
}

/** Modifications d'un de mes projets : la vitrine, le détail et le portfolio du profil sont rafraîchis ensemble. */
export function useProjectMutations(id: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["showcase"] });
    void client.invalidateQueries({ queryKey: ["portfolio"] });
  };
  return {
    update: useMutation({ mutationFn: (input: ProjectInput) => showcaseApi.update(id, input), onSuccess: refresh }),
    remove: useMutation({
      mutationFn: () => showcaseApi.remove(id),
      onSuccess: () => {
        client.removeQueries({ queryKey: showcaseKeys.project(id) });
        refresh();
      },
    }),
    addLink: useMutation({ mutationFn: ({ kind, url }: { kind: string; url: string }) => showcaseApi.addLink(id, kind, url), onSuccess: refresh }),
    removeLink: useMutation({ mutationFn: (linkId: string) => showcaseApi.removeLink(id, linkId), onSuccess: refresh }),
    addMedia: useMutation({ mutationFn: (file: string) => showcaseApi.addMedia(id, file), onSuccess: refresh }),
    removeMedia: useMutation({ mutationFn: (mediaId: string) => showcaseApi.removeMedia(id, mediaId), onSuccess: refresh }),
  };
}

/** Titre, présentation et visibilité de MON portfolio (la vitrine applique cette visibilité à tous mes projets). */
export function usePortfolioSettings(username: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; summary?: string; visibility?: string }) => authed(`/me/portfolio/`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["portfolio", username] });
      void client.invalidateQueries({ queryKey: ["showcase"] });
    },
  });
}
