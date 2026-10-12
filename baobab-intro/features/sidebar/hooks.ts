"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed } from "@/lib/api/authed";
import type { UserBrief } from "@/features/social/types";

export interface GroupInvitation {
  id: string;
  group: { slug: string; name: string };
  invited_by: UserBrief;
  expires_at: string | null;
}

export interface ClassroomInvitation {
  id: string;
  classroom: { slug: string; title: string };
  role: string;
  invited_by: UserBrief;
  expires_at: string | null;
}

export interface GroupCard {
  slug: string;
  name: string;
  description: string;
  privacy: "public" | "private" | "hidden";
  join_policy: string;
  member_count: number;
  avatar_url: string | null;
  my_role: string | null;
  my_request_pending: boolean;
}

export function useGroupInvitations() {
  return useQuery({ queryKey: ["invitations", "groups"], queryFn: () => authed<GroupInvitation[]>("/me/group-invitations/"), staleTime: 60_000 });
}

export function useClassroomInvitations() {
  return useQuery({ queryKey: ["invitations", "classrooms"], queryFn: () => authed<ClassroomInvitation[]>("/me/classroom-invitations/"), staleTime: 60_000 });
}

export function useRespondInvitation(kind: "groups" | "classrooms") {
  const client = useQueryClient();
  const base = kind === "groups" ? "/group-invitations/" : "/classroom-invitations/";
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => authed(`${base}${id}/respond/`, { method: "POST", body: { accept } }),
    onSuccess: (_data, { id }) => {
      client.setQueryData<Array<{ id: string }>>(["invitations", kind], (list) => list?.filter((i) => i.id !== id));
      if (kind === "groups") void client.invalidateQueries({ queryKey: ["me", "groups"] });
    },
  });
}

/** Groupes à découvrir : ceux dont je ne suis pas membre (GET /groups/). */
export function useSuggestedGroups() {
  return useQuery({
    queryKey: ["groups", "suggested"],
    queryFn: () => authed<{ results: GroupCard[] }>("/groups/?limit=12").then((p) => p.results.filter((g) => !g.my_role && g.join_policy !== "invite_only").slice(0, 3)),
    staleTime: 5 * 60_000,
  });
}

export function useJoinGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => authed<{ status: "joined" | "pending" }>(`/groups/${slug}/join/`, { method: "POST", body: {} }),
    onSuccess: (result, slug) => {
      client.setQueryData<GroupCard[]>(["groups", "suggested"], (list) =>
        list?.map((g) => (g.slug === slug ? { ...g, my_role: result.status === "joined" ? "member" : null, my_request_pending: result.status === "pending" } : g)),
      );
      void client.invalidateQueries({ queryKey: ["me", "groups"] });
    },
  });
}
