/**
 * Requêtes authentifiées de l'espace membre.
 * - ajoute le jeton d'accès (rafraîchi si besoin) ;
 * - sur 401, force UN rafraîchissement puis rejoue la requête (consigne du backend) ;
 * - sans session récupérable : lève ApiError("not_authenticated") — le gabarit renvoie vers /connexion.
 */
import { getAccessToken, invalidateAccessToken } from "@/lib/auth/session";
import { apiRequest, type RequestOptions } from "./client";
import { ApiError } from "./errors";

export async function authed<T>(path: string, options: Omit<RequestOptions, "accessToken"> = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, "not_authenticated");
  try {
    return await apiRequest<T>(path, { ...options, accessToken: token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    invalidateAccessToken();
    const fresh = await getAccessToken();
    if (!fresh) throw new ApiError(401, "not_authenticated");
    return apiRequest<T>(path, { ...options, accessToken: fresh });
  }
}

/** Réponse paginée par curseur du backend : on suit « next » tel quel. */
export interface Page<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Convertit l'URL absolue « next » renvoyée par l'API en chemin relatif à API_BASE_URL. */
export function nextPath(next: string | null): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, "https://x.invalid");
    const index = url.pathname.indexOf("/api/v1");
    const path = index >= 0 ? url.pathname.slice(index + "/api/v1".length) : url.pathname;
    return `${path}${url.search}`;
  } catch {
    return null;
  }
}
