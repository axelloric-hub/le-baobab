"use client";

import { useState } from "react";
import { GitHubIcon, SpinnerIcon } from "@/components/landing/icons";
import { describeError } from "@/lib/api/errors";
import { authService } from "@/lib/auth/auth-service";
import { AUTH_COMMON } from "./auth-content";
import styles from "./Auth.module.css";

/**
 * « Continuer avec GitHub » : demande au backend l'adresse d'autorisation GitHub
 * (GET /auth/github/start/), puis y envoie le navigateur. Au retour, GitHub repasse
 * par le backend, qui redirige vers /connexion/github?ticket=… (voir GitHubCallback).
 * Fonctionne pour la connexion ET la création de compte (premier passage).
 */
export function GitHubButton({ onError }: { onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const { authorize_url } = await authService.startGitHubLogin();
      const target = new URL(authorize_url);
      if (target.protocol !== "https:" || target.hostname !== "github.com") throw new Error("unexpected_redirect");
      window.location.assign(target.toString());
    } catch (error) {
      setLoading(false);
      onError(describeError(error));
    }
  };

  return (
    <button type="button" className={styles.github} onClick={start} disabled={loading} aria-busy={loading || undefined}>
      {loading ? <SpinnerIcon aria-hidden="true" className={styles.spinner} /> : <GitHubIcon aria-hidden="true" />}
      {loading ? AUTH_COMMON.githubLoading : AUTH_COMMON.github}
    </button>
  );
}
