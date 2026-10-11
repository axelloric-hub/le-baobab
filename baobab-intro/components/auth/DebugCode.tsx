"use client";

import { AUTH_COMMON } from "./auth-content";
import styles from "./Auth.module.css";

/**
 * Serveur en phase de test (OTP_DEBUG_ECHO=true) : il renvoie le code dans sa réponse,
 * on l'affiche pour pouvoir tester sans boîte mail. Disparaît seul quand le serveur
 * passe en production (le code n'est alors plus renvoyé).
 */
export function DebugCode({ code, onFill }: { code?: string; onFill: (code: string) => void }) {
  if (!code) return null;
  return (
    <p className={styles.debug}>
      <span>
        {AUTH_COMMON.serverTestCode} <code>{code}</code>
      </span>
      <button type="button" onClick={() => onFill(code)}>
        {AUTH_COMMON.fillCode}
      </button>
    </p>
  );
}
