/**
 * Session côté navigateur.
 *
 * - Jeton d'accès (courte durée) : en mémoire uniquement.
 * - Jeton de rafraîchissement + profil minimal : localStorage (survit à la fermeture de l'onglet).
 * - Rafraîchissement : un seul à la fois, y compris entre plusieurs onglets (Web Locks API),
 *   indispensable car le backend invalide l'ancien jeton à chaque rotation.
 */
import { authService } from "./auth-service";
import { markAsMember } from "./member-cookie";
import type { AuthSession, AuthUser } from "./types";

const STORAGE_KEY = "baobab.session.v1";
/** Marge avant expiration à partir de laquelle on rafraîchit le jeton d'accès. */
const EXPIRY_MARGIN_MS = 30_000;

interface StoredSession {
  refresh: string;
  user: AuthUser;
}

let access: { token: string; expiresAt: number } | null = null;
let pendingRefresh: Promise<string | null> | null = null;

function readStored(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return typeof parsed?.refresh === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredSession | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible (navigation privée stricte) : la session reste en mémoire */
  }
}

/** Date d'expiration (ms) lue dans le jeton JWT ; 0 si illisible. */
function expiryOf(token: string): number {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Enregistre la session reçue après connexion, confirmation d'e-mail ou GitHub. */
export function startSession(session: AuthSession) {
  access = { token: session.access, expiresAt: expiryOf(session.access) };
  writeStored({ refresh: session.refresh, user: session.user });
  markAsMember();
}

export function clearSession() {
  access = null;
  writeStored(null);
}

export function currentUser(): AuthUser | null {
  return typeof window === "undefined" ? null : (readStored()?.user ?? null);
}

export function hasStoredSession(): boolean {
  return typeof window !== "undefined" && readStored() !== null;
}

async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? locks.request("baobab-refresh", task) : task();
}

async function refreshAccessToken(): Promise<string | null> {
  return withRefreshLock(async () => {
    const stored = readStored();
    if (!stored) return null;
    try {
      const tokens = await authService.refreshTokens(stored.refresh);
      access = { token: tokens.access, expiresAt: expiryOf(tokens.access) };
      writeStored({ refresh: tokens.refresh ?? stored.refresh, user: stored.user });
      return tokens.access;
    } catch (error) {
      // Un autre onglet a peut-être déjà fait la rotation : on relit avant de conclure.
      const latest = readStored();
      if (latest && latest.refresh !== stored.refresh) {
        try {
          const tokens = await authService.refreshTokens(latest.refresh);
          access = { token: tokens.access, expiresAt: expiryOf(tokens.access) };
          writeStored({ refresh: tokens.refresh ?? latest.refresh, user: latest.user });
          return tokens.access;
        } catch {
          /* on retombe sur la déconnexion ci-dessous */
        }
      }
      const status = (error as { status?: number }).status ?? 0;
      if (status === 400 || status === 401 || status === 403) clearSession();
      return null;
    }
  });
}

/**
 * Jeton d'accès valide, rafraîchi si nécessaire. null = pas (ou plus) de session :
 * la page doit renvoyer vers la connexion.
 */
export async function getAccessToken(): Promise<string | null> {
  if (access && access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return access.token;
  if (!hasStoredSession()) return null;
  pendingRefresh ??= refreshAccessToken().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

/** Déconnexion : invalide le jeton de rafraîchissement côté serveur, puis efface la session locale. */
export async function endSession() {
  const stored = readStored();
  clearSession();
  if (stored) {
    try {
      await authService.logout(stored.refresh);
    } catch {
      /* déjà invalide ou serveur injoignable : la session locale est effacée de toute façon */
    }
  }
}
