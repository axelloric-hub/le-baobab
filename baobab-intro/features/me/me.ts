"use client";

import { useQuery } from "@tanstack/react-query";
import { authed } from "@/lib/api/authed";
import type { Visibility } from "@/features/social/types";

/** GET /me/ — identité et réglages du membre connecté. */
export interface Me {
  username: string;
  display_name: string;
  avatar_url: string | null;
  headline: string;
  email: string;
  privacy: {
    default_post_visibility: Visibility;
    default_status_visibility: Visibility;
    [key: string]: unknown;
  };
}

export const meKey = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => authed<Me>("/me/"), staleTime: 5 * 60_000 });
}

export interface MyGroup {
  slug: string;
  name: string;
  avatar_url: string | null;
  my_role: string | null;
}

/** Mes groupes (cible possible d'une publication). */
export function useMyGroups(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "groups"],
    queryFn: () => authed<{ results: MyGroup[] }>("/me/groups/?limit=50").then((p) => p.results),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export interface MyEnrollment {
  course: { id: string; title: string; slug: string; classroom: string };
  status: string;
  progress: { total_chapters: number; completed_chapters: number; percent: number };
}

/** Mes cours en cours (menu latéral « Mes cours »). */
export function useMyEnrollments() {
  return useQuery({
    queryKey: ["me", "enrollments"],
    queryFn: () =>
      authed<{ results: MyEnrollment[] }>("/me/enrollments/").then((p) => p.results.filter((e) => e.status === "active").slice(0, 3)),
    staleTime: 5 * 60_000,
  });
}
