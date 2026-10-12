/**
 * Adresse de l'API LE BAOBAB.
 *
 * NEXT_PUBLIC_API_BASE_URL — adresse publique de l'API, préfixe /api/v1 compris, SANS barre finale.
 *   Production (Vercel) : https://baobab-router.pages.dev/api/v1
 *   Développement local : idem, ou http://localhost:8000/api/v1 avec le backend lancé en local.
 * Sans valeur, « /api/v1 » est utilisé : cela ne fonctionne que si le site est servi
 * par le routeur Cloudflare (même domaine que l'API).
 *
 * Variable lue au moment du build (préfixe NEXT_PUBLIC_) : après l'avoir modifiée sur Vercel, redéployer.
 */
const RAW = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

export const API_BASE_URL = (RAW || "/api/v1").replace(/\/+$/, "");

/** Temps maximal d'une requête : le serveur gratuit (Render) peut mettre jusqu'à une minute à se réveiller. */
export const API_TIMEOUT_MS = 60_000;

/**
 * Adresse WebSocket du serveur, déduite de l'adresse de l'API :
 * https://routeur/api/v1 → wss://routeur  (les sockets sont servis sur /ws/…).
 */
export function websocketBase(): string {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(API_BASE_URL, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${url.protocol}//${url.host}`;
}
