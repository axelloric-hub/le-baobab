"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import type { Post } from "@/features/social/types";
import { peopleApi } from "./api";

export const peopleKeys = {
  profile: (username: string) => ["profile", username] as const,
  posts: (username: string) => ["user-posts", username] as const,
  portfolio: (username: string) => ["portfolio", username] as const,
  search: (q: string) => ["users", "search", q] as const,
};

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Recherche de membres (2 caractères minimum, profils « recherchables » seulement). */
export function usePeopleSearch(query: string) {
  const q = useDebounced(query.trim().replace(/^@/, ""));
  return useQuery({ queryKey: peopleKeys.search(q), queryFn: () => peopleApi.search(q), enabled: q.length >= 2, staleTime: 60_000 });
}

export function useProfile(username: string) {
  return useQuery({ queryKey: peopleKeys.profile(username), queryFn: () => peopleApi.profile(username), staleTime: 30_000 });
}

export function useUserPosts(username: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: peopleKeys.posts(username),
    queryFn: ({ pageParam }) => peopleApi.posts(username, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Post>) => nextPath(last.next),
    enabled,
  });
}

export function usePortfolio(username: string) {
  return useQuery({ queryKey: peopleKeys.portfolio(username), queryFn: () => peopleApi.portfolio(username), staleTime: 60_000, retry: false, enabled: Boolean(username) });
}
