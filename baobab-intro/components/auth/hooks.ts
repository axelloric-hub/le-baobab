"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken, hasStoredSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

/** Délai imposé par le serveur entre deux envois de code. */
export const RESEND_DELAY_S = 60;

/** Secondes restantes avant `until` (horodatage en ms), mises à jour chaque seconde. */
export function useCountdown(until: number | null): number {
  const compute = () => (until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    if (!until) return;
    const timer = window.setInterval(() => {
      const next = compute();
      setLeft(next);
      if (next <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return left;
}

/** Déjà connecté (session valide) : on ne remontre pas les formulaires, direction l'espace membre. */
export function useRedirectIfAuthenticated() {
  const router = useRouter();
  useEffect(() => {
    if (!hasStoredSession()) return;
    let cancelled = false;
    getAccessToken().then((token) => {
      if (token && !cancelled) router.replace(ROUTES.memberSpace);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Même règle que le backend (apps/accounts/models.py : USERNAME_RE). */
export const USERNAME_RE = /^[a-z0-9][a-z0-9_.]{2,29}$/;

/** a••••@exemple.org */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${"•".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}
