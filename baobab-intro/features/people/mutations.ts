"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meKey } from "@/features/me/me";
import { authed } from "@/lib/api/authed";
import { peopleApi } from "./api";
import { peopleKeys } from "./hooks";
import type { Profile, Relation } from "./types";

type RelationAction =
  | "friend-request"
  | "accept"
  | "decline"
  | "cancel-request"
  | "unfriend"
  | "follow"
  | "unfollow"
  | "close-on"
  | "close-off"
  | "block"
  | "mute";

/** Actions de relation avec mise à jour immédiate du profil affiché (puis relecture du serveur). */
export function useRelationAction(profile: Profile) {
  const client = useQueryClient();
  const key = peopleKeys.profile(profile.username);
  const patch = (update: (r: Relation, p: Profile) => Partial<Profile>) =>
    client.setQueryData<Profile>(key, (p) => (p && p.relation ? { ...p, ...update(p.relation, p) } : p));

  return useMutation({
    mutationFn: async (action: RelationAction) => {
      const u = profile.username;
      const request = profile.relation?.friend_request;
      switch (action) {
        case "friend-request":
          return peopleApi.sendFriendRequest(u);
        case "accept":
          return peopleApi.respondFriendRequest(request!.id, true);
        case "decline":
          return peopleApi.respondFriendRequest(request!.id, false);
        case "cancel-request":
        case "unfriend":
          return peopleApi.removeFriend(u);
        case "follow":
          return peopleApi.follow(u);
        case "unfollow":
          return peopleApi.unfollow(u);
        case "close-on":
          return peopleApi.closeFriend(u, true);
        case "close-off":
          return peopleApi.closeFriend(u, false);
        case "block":
          return peopleApi.block(u);
        case "mute":
          return peopleApi.mute(u);
      }
    },
    onMutate: (action) => {
      const previous = client.getQueryData<Profile>(key);
      const stat = (p: Profile, field: "followers" | "friends", delta: number) => (p.stats ? { stats: { ...p.stats, [field]: Math.max(0, p.stats[field] + delta) } } : {});
      if (action === "follow") patch((r, p) => ({ relation: { ...r, is_following: true }, ...stat(p, "followers", 1) }));
      if (action === "unfollow") patch((r, p) => ({ relation: { ...r, is_following: false }, ...stat(p, "followers", -1) }));
      if (action === "accept") patch((r, p) => ({ relation: { ...r, is_friend: true, friend_request: null }, ...stat(p, "friends", 1) }));
      if (action === "decline" || action === "cancel-request") patch((r) => ({ relation: { ...r, friend_request: null } }));
      if (action === "unfriend") patch((r, p) => ({ relation: { ...r, is_friend: false, is_close_friend: false }, ...stat(p, "friends", -1) }));
      if (action === "close-on") patch((r) => ({ relation: { ...r, is_close_friend: true } }));
      if (action === "close-off") patch((r) => ({ relation: { ...r, is_close_friend: false } }));
      return { previous };
    },
    onError: (_e, _a, context) => context?.previous && client.setQueryData(key, context.previous),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

/** Mise à jour de mon profil : identité, compétences, liens. */
export function useUpdateMe(username: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: meKey });
    void client.invalidateQueries({ queryKey: peopleKeys.profile(username) });
  };
  return {
    profile: useMutation({ mutationFn: (fields: Record<string, unknown>) => authed("/me/profile/", { method: "PATCH", body: fields }), onSuccess: refresh }),
    skills: useMutation({ mutationFn: (skills: Array<{ slug: string; level: number }>) => authed("/me/skills/", { method: "PUT", body: { skills } }), onSuccess: refresh }),
    addLink: useMutation({ mutationFn: (link: { provider: string; url: string }) => authed("/me/links/", { method: "POST", body: link }), onSuccess: refresh }),
    removeLink: useMutation({ mutationFn: (id: string) => authed(`/me/links/${id}/`, { method: "DELETE" }), onSuccess: refresh }),
  };
}

/** Portfolio : ajout et suppression d'entrées. */
export function usePortfolioMutations(username: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: peopleKeys.portfolio(username) });
    void client.invalidateQueries({ queryKey: ["showcase"] });
  };
  return {
    add: useMutation({
      mutationFn: ({ kind, body }: { kind: string; body: Record<string, unknown> }) => authed(`/me/portfolio/${kind}/`, { method: "POST", body }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ kind, id }: { kind: string; id: string }) => authed(`/me/portfolio/${kind}/${id}/`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}
