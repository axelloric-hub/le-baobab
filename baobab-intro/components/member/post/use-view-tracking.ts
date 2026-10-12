"use client";

import { useEffect, type RefObject } from "react";
import { socialApi } from "@/features/social/api";

/** Publications déjà comptées pendant cette session d'onglet : une vue par publication. */
const counted = new Set<string>();

/**
 * Compte une vue quand la publication reste visible (au moins 50 %) pendant 1 seconde.
 * Le serveur déduplique aussi (1 h par membre) : ceci évite seulement des requêtes inutiles.
 */
export function useViewTracking(ref: RefObject<HTMLElement | null>, postId: string) {
  useEffect(() => {
    const node = ref.current;
    if (!node || counted.has(postId) || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = window.setTimeout(() => {
            if (counted.has(postId)) return;
            counted.add(postId);
            observer.disconnect();
            socialApi.view(postId).catch(() => counted.delete(postId));
          }, 1000);
        } else {
          window.clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, postId]);
}
