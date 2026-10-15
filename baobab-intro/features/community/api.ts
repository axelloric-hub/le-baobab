/** Couche service : groupes et communautés. Une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type { Post } from "@/features/social/types";
import type { Community, CreateGroupInput, Group, GroupMember, JoinRequest, UpdateGroupInput } from "./types";

const g = (slug: string) => `/groups/${encodeURIComponent(slug)}`;

export const communityApi = {
  discover: (params: { q?: string; community?: string }, path?: string) => {
    if (path) return authed<Page<Group>>(path);
    const query = new URLSearchParams({ limit: "24" });
    if (params.q) query.set("q", params.q);
    if (params.community) query.set("community", params.community);
    return authed<Page<Group>>(`/groups/?${query}`);
  },
  mine: (path?: string) => authed<Page<Group>>(path ?? "/me/groups/?limit=50"),
  detail: (slug: string) => authed<Group>(`${g(slug)}/`),
  create: (input: CreateGroupInput) => authed<Group>("/groups/", { method: "POST", body: input }),
  update: (slug: string, input: UpdateGroupInput) => authed<Group>(`${g(slug)}/`, { method: "PATCH", body: input }),
  posts: (slug: string, path?: string) => authed<Page<Post>>(path ?? `${g(slug)}/posts/`),
  members: (slug: string, path?: string) => authed<Page<GroupMember>>(path ?? `${g(slug)}/members/`),
  join: (slug: string) => authed<{ status: "joined" | "pending" }>(`${g(slug)}/join/`, { method: "POST", body: {} }),
  leave: (slug: string) => authed<void>(`${g(slug)}/leave/`, { method: "POST", body: {} }),
  invite: (slug: string, username: string) => authed<{ id: string; status: string }>(`${g(slug)}/invite/`, { method: "POST", body: { username } }),
  joinRequests: (slug: string) => authed<JoinRequest[]>(`${g(slug)}/join-requests/`),
  reviewRequest: (id: string, approve: boolean) => authed<{ id: string; status: string }>(`/group-join-requests/${id}/review/`, { method: "POST", body: { approve } }),
  ban: (slug: string, username: string, reason: string) => authed(`${g(slug)}/ban/`, { method: "POST", body: { username, reason } }),
  mute: (slug: string, username: string, minutes: number, reason: string) => authed(`${g(slug)}/mute/`, { method: "POST", body: { username, minutes, reason } }),
  communities: () => authed<Community[]>("/communities/"),
};
