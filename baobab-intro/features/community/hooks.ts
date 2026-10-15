"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import { useDebounced } from "@/features/people/hooks";
import type { Post } from "@/features/social/types";
import { communityApi } from "./api";
import type { CreateGroupInput, Group, GroupMember, GroupPermission, UpdateGroupInput } from "./types";

export const groupKeys = {
  all: ["groups"] as const,
  discover: (q: string, community: string) => ["groups", "discover", q, community] as const,
  mine: ["groups", "mine"] as const,
  detail: (slug: string) => ["group", slug] as const,
  posts: (slug: string) => ["group-posts", slug] as const,
  members: (slug: string) => ["group", slug, "members"] as const,
  requests: (slug: string) => ["group", slug, "requests"] as const,
  communities: ["communities"] as const,
};

/** Le membre a-t-il cette permission dans le groupe ? */
export const canInGroup = (group: Pick<Group, "my_permissions"> | undefined, permission: GroupPermission) =>
  Boolean(group?.my_permissions?.includes(permission));

function useGroupPages(key: readonly unknown[], first: () => Promise<Page<Group>>, next: (path: string) => Promise<Page<Group>>, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => (pageParam ? next(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Group>) => nextPath(last.next),
    enabled,
    staleTime: 30_000,
  });
}

/** Découvrir : groupes publics et privés (jamais les secrets), recherche par nom et filtre de communauté. */
export function useDiscoverGroups(query: string, community: string) {
  const q = useDebounced(query.trim());
  return useGroupPages(
    groupKeys.discover(q, community),
    () => communityApi.discover({ q: q.length >= 2 ? q : undefined, community: community || undefined }),
    (path) => communityApi.discover({}, path),
  );
}

export function useMyGroupPages() {
  return useGroupPages(groupKeys.mine, () => communityApi.mine(), (path) => communityApi.mine(path));
}

export function useGroup(slug: string) {
  return useQuery({ queryKey: groupKeys.detail(slug), queryFn: () => communityApi.detail(slug), staleTime: 30_000 });
}

export function useGroupPosts(slug: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: groupKeys.posts(slug),
    queryFn: ({ pageParam }) => communityApi.posts(slug, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Post>) => nextPath(last.next),
    enabled,
  });
}

export function useGroupMembers(slug: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: groupKeys.members(slug),
    queryFn: ({ pageParam }) => communityApi.members(slug, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<GroupMember>) => nextPath(last.next),
    enabled,
  });
}

export function useJoinRequests(slug: string, enabled: boolean) {
  return useQuery({ queryKey: groupKeys.requests(slug), queryFn: () => communityApi.joinRequests(slug), enabled, staleTime: 30_000 });
}

export function useCommunities() {
  return useQuery({ queryKey: groupKeys.communities, queryFn: communityApi.communities, staleTime: 10 * 60_000 });
}

/** Après une adhésion ou un départ : la carte, le détail, mes groupes (menu latéral compris) sont relus. */
function useRefreshGroup() {
  const client = useQueryClient();
  return (slug: string) => {
    void client.invalidateQueries({ queryKey: groupKeys.all });
    void client.invalidateQueries({ queryKey: groupKeys.detail(slug) });
    void client.invalidateQueries({ queryKey: groupKeys.posts(slug) });
    void client.invalidateQueries({ queryKey: ["me", "groups"] });
  };
}

export function useJoin() {
  const client = useQueryClient();
  const refresh = useRefreshGroup();
  return useMutation({
    mutationFn: (slug: string) => communityApi.join(slug),
    onSuccess: (result, slug) => {
      client.setQueryData<Group>(groupKeys.detail(slug), (g) =>
        g ? { ...g, my_role: result.status === "joined" ? "member" : g.my_role, my_request_pending: result.status === "pending", member_count: g.member_count + (result.status === "joined" ? 1 : 0) } : g,
      );
      refresh(slug);
    },
  });
}

export function useLeave() {
  const refresh = useRefreshGroup();
  return useMutation({ mutationFn: (slug: string) => communityApi.leave(slug), onSuccess: (_d, slug) => refresh(slug) });
}

export function useCreateGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => communityApi.create(input),
    onSuccess: (group) => {
      client.setQueryData(groupKeys.detail(group.slug), group);
      void client.invalidateQueries({ queryKey: groupKeys.all });
      void client.invalidateQueries({ queryKey: ["me", "groups"] });
    },
  });
}

export function useUpdateGroup(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGroupInput) => communityApi.update(slug, input),
    onSuccess: (group) => {
      client.setQueryData(groupKeys.detail(slug), group);
      void client.invalidateQueries({ queryKey: groupKeys.all });
      void client.invalidateQueries({ queryKey: ["me", "groups"] });
    },
  });
}

export function useReviewRequest(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => communityApi.reviewRequest(id, approve),
    onSuccess: (_d, { id, approve }) => {
      client.setQueryData<Array<{ id: string }>>(groupKeys.requests(slug), (list) => list?.filter((r) => r.id !== id));
      if (approve) {
        client.setQueryData<Group>(groupKeys.detail(slug), (g) => (g ? { ...g, member_count: g.member_count + 1 } : g));
        void client.invalidateQueries({ queryKey: groupKeys.members(slug) });
      }
    },
  });
}

/** Modération d'un membre : sourdine (durée) ou bannissement (retiré de la liste). */
export function useModerate(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: { kind: "ban"; username: string; reason: string } | { kind: "mute"; username: string; minutes: number; reason: string }) =>
      action.kind === "ban" ? communityApi.ban(slug, action.username, action.reason) : communityApi.mute(slug, action.username, action.minutes, action.reason),
    onSuccess: (_d, action) => {
      if (action.kind !== "ban") return;
      client.setQueryData<{ pages: Page<GroupMember>[]; pageParams: unknown[] }>(groupKeys.members(slug), (data) =>
        data ? { ...data, pages: data.pages.map((p) => ({ ...p, results: p.results.filter((m) => m.username !== action.username) })) } : data,
      );
      client.setQueryData<Group>(groupKeys.detail(slug), (g) => (g ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g));
    },
  });
}
