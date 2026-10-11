/**
 * Données temporaires entre deux écrans (onglet courant uniquement, sessionStorage) :
 * l'adresse en attente de confirmation, pour ne pas la faire passer dans l'URL.
 */
import type { OtpIssue } from "./types";

const PENDING_KEY = "baobab.pending.v1";
const LOGIN_NOTICE_KEY = "baobab.login-notice.v1";

export interface PendingVerification {
  email: string;
  sentAt: number;
  issue?: OtpIssue;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sans stockage, l'écran suivant redemandera l'adresse */
  }
}

export const pendingVerification = {
  get: () => read<PendingVerification>(PENDING_KEY),
  set: (email: string, issue?: OtpIssue) => write(PENDING_KEY, { email, issue, sentAt: Date.now() } satisfies PendingVerification),
  clear: () => write(PENDING_KEY, null),
};

/** Message à afficher sur la page de connexion (ex. après une réinitialisation de mot de passe). */
export const loginNotice = {
  take(): { kind: "password_reset"; email: string } | null {
    const value = read<{ kind: "password_reset"; email: string }>(LOGIN_NOTICE_KEY);
    write(LOGIN_NOTICE_KEY, null);
    return value;
  },
  set: (value: { kind: "password_reset"; email: string }) => write(LOGIN_NOTICE_KEY, value),
};
