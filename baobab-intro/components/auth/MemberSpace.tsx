"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import styles from "./Auth.module.css";

/**
 * Espace membre — volontairement une page blanche, en attendant le design des pages suivantes.
 * Seule logique : sans session valide, retour à la connexion.
 */
export function MemberSpace() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAccessToken().then((token) => {
      if (cancelled) return;
      if (token) setAllowed(true);
      else router.replace(ROUTES.login);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className={styles.blank} data-ready={allowed || undefined}>
      <h1 className="bb-visually-hidden">Espace membre LE BAOBAB</h1>
    </main>
  );
}
