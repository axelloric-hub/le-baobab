/** Couche service Showcase : une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type { ProjectInput, ShowcaseFilters, ShowcaseProject, ShowcaseProjectDetail, Technology } from "./types";

const mine = (id: string) => `/me/portfolio/projects/${id}`;

export const showcaseApi = {
  projects: (filters: ShowcaseFilters, path?: string) => {
    if (path) return authed<Page<ShowcaseProject>>(path);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return authed<Page<ShowcaseProject>>(`/showcase/projects/?${query}`);
  },
  technologies: () => authed<Array<Technology & { projects: number }>>("/showcase/technologies/"),
  project: (id: string) => authed<ShowcaseProjectDetail>(`/showcase/projects/${id}/`),
  update: (id: string, input: ProjectInput) => authed<ShowcaseProject>(`${mine(id)}/`, { method: "PATCH", body: input }),
  remove: (id: string) => authed<void>(`/me/portfolio/projects/${id}/`, { method: "DELETE" }),
  addLink: (id: string, kind: string, url: string) => authed<{ id: string }>(`${mine(id)}/links/`, { method: "POST", body: { kind, url } }),
  removeLink: (id: string, linkId: string) => authed<void>(`${mine(id)}/links/${linkId}/`, { method: "DELETE" }),
  addMedia: (id: string, file: string) => authed<{ added: boolean }>(`${mine(id)}/media/`, { method: "POST", body: { file } }),
  removeMedia: (id: string, mediaId: string) => authed<void>(`${mine(id)}/media/${mediaId}/`, { method: "DELETE" }),
};
