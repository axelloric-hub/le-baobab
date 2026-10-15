"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { ApiError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { PostComposer } from "./composer/PostComposer";
import { AppShell } from "./shell/AppShell";
import { CommandPalette } from "./shell/CommandPalette";
import { CreationContext, type ComposerTool, type GroupTarget } from "./shell/creation-context";
import styles from "./shell/Shell.module.css";
import { StatusComposer } from "./statuses/StatusComposer";
import { ToastProvider } from "./ui/Toast";

const isUnauthenticated = (error: unknown) => error instanceof ApiError && (error.code === "not_authenticated" || error.status === 401);

/**
 * Racine de l'espace membre : cache des données, session, fenêtres de création globales, gabarit.
 * Sans session valide (ou session expirée en cours de route) : retour à la connexion.
 */
export function MemberApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const toLogin = useCallback(() => router.replace(ROUTES.login), [router]);

  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: (error) => isUnauthenticated(error) && toLogin() }),
        mutationCache: new MutationCache({ onError: (error) => isUnauthenticated(error) && toLogin() }),
        defaultOptions: {
          queries: {
            // Réseau mobile instable : 2 nouvelles tentatives, sauf erreurs définitives (4xx).
            retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    let cancelled = false;
    getAccessToken().then((token) => {
      if (cancelled) return;
      if (token) setReady(true);
      else toLogin();
    });
    return () => {
      cancelled = true;
    };
  }, [toLogin]);

  const [composer, setComposer] = useState<{ open: boolean; tool?: ComposerTool; group?: GroupTarget }>({ open: false });
  const [statusOpen, setStatusOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const creation = useMemo(
    () => ({
      openPost: (tool?: ComposerTool, group?: GroupTarget) => setComposer({ open: true, tool, group }),
      openStatus: () => setStatusOpen(true),
      openSearch: () => setSearchOpen(true),
    }),
    [],
  );

  // Ctrl + K / ⌘ + K : recherche, partout dans l'espace membre.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) {
    return (
      <div className={styles.splash} role="status">
        <BaobabMark className={styles.splashMark} title={null} />
        <span className="bb-visually-hidden">Ouverture de votre espace…</span>
      </div>
    );
  }

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <CreationContext.Provider value={creation}>
          <AppShell>{children}</AppShell>
          <PostComposer open={composer.open} tool={composer.tool} group={composer.group} onClose={() => setComposer({ open: false })} />
          <StatusComposer open={statusOpen} onClose={() => setStatusOpen(false)} />
          <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        </CreationContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
