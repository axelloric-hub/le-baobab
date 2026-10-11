"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GitHubIcon, SpinnerIcon } from "@/components/landing/icons";
import { ApiError, describeError } from "@/lib/api/errors";
import { authService } from "@/lib/auth/auth-service";
import { startSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { GITHUB_CALLBACK } from "./auth-content";
import { Alert } from "./fields";
import styles from "./Auth.module.css";

/**
 * Retour de GitHub : le backend redirige ici avec ?ticket=… (succès) ou ?error=code (échec).
 * Le billet est à usage unique et valable 90 s : on l'échange immédiatement contre les jetons.
 */
export function GitHubCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // le billet ne doit être échangé qu'une fois
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    // On retire le billet de l'adresse (historique, partage d'écran).
    window.history.replaceState(null, "", window.location.pathname);
    const ticket = params.get("ticket");
    const errorCode = params.get("error");
    if (errorCode || !ticket) {
      setError(describeError(new ApiError(400, errorCode ?? "github_callback_invalid")));
      return;
    }
    authService
      .exchangeGitHubTicket(ticket)
      .then((session) => {
        startSession(session);
        router.replace(ROUTES.memberSpace);
      })
      .catch((exchangeError) => setError(describeError(exchangeError)));
  }, [router]);

  return (
    <div className={`${styles.card} ${styles.cardCentered}`}>
      <span className={styles.heroIcon} data-tone="dark" aria-hidden="true">
        <GitHubIcon />
      </span>
      {error ? (
        <>
          <h1 className={styles.title}>{GITHUB_CALLBACK.failed}</h1>
          <Alert tone="error">{error}</Alert>
          <Link href={ROUTES.login} className={styles.submitLink}>
            {GITHUB_CALLBACK.retry}
          </Link>
        </>
      ) : (
        <>
          <h1 className={styles.title}>{GITHUB_CALLBACK.loading}</h1>
          <SpinnerIcon aria-hidden="true" className={`${styles.spinner} ${styles.bigSpinner}`} />
        </>
      )}
    </div>
  );
}
