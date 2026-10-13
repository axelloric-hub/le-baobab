/** Couche service : personnes, profils, relations, portfolio. */
import { authed, type Page } from "@/lib/api/authed";
import type { Post, UserBrief } from "@/features/social/types";
import type { FriendRequestIn, Portfolio, Profile } from "./types";

const u = (username: string) => encodeURIComponent(username);

export const peopleApi = {
  search: (q: string) => authed<UserBrief[]>(`/users/?q=${encodeURIComponent(q)}`),
  profile: (username: string) => authed<Profile>(`/users/${u(username)}/`),
  posts: (username: string, path?: string) => authed<Page<Post>>(path ?? `/users/${u(username)}/posts/`),
  portfolio: (username: string) => authed<Portfolio>(`/users/${u(username)}/portfolio/`),

  sendFriendRequest: (username: string) => authed<{ id: string; status: string }>("/friends/requests/", { method: "POST", body: { username } }),
  respondFriendRequest: (id: string, accept: boolean) => authed<{ id: string; status: string }>(`/friends/requests/${id}/respond/`, { method: "POST", body: { accept } }),
  /** Retire un ami OU annule une demande en attente (le serveur supprime la relation). */
  removeFriend: (username: string) => authed<void>(`/friends/${u(username)}/`, { method: "DELETE" }),
  incomingRequests: () => authed<FriendRequestIn[]>("/friends/requests/"),
  follow: (username: string) => authed(`/users/${u(username)}/follow/`, { method: "POST", body: {} }),
  unfollow: (username: string) => authed<void>(`/users/${u(username)}/follow/`, { method: "DELETE" }),
  closeFriend: (username: string, on: boolean) => authed(`/users/${u(username)}/close-friend/`, { method: on ? "POST" : "DELETE", body: on ? {} : undefined }),
  block: (username: string) => authed(`/users/${u(username)}/block/`, { method: "POST", body: {} }),
  mute: (username: string) => authed(`/users/${u(username)}/mute/`, { method: "POST", body: { scope: "all" } }),
};
