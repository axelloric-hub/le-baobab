/**
 * Reconnaissance des membres qui reviennent.
 *
 * Après une inscription ou une connexion réussie, le navigateur reçoit le cookie
 * « baobab_membre ». À la visite suivante de l'accueil, proxy.ts le lit et envoie
 * directement vers la page de connexion. Le cookie ne contient aucune donnée
 * personnelle (juste « 1 ») et n'est pas effacé à la déconnexion : la personne reste membre.
 *
 * Pourquoi pas l'adresse IP : voir docs/AUTH.md (IP partagées par opérateur, cybercafés,
 * IP qui changent ; et une API « cette IP a-t-elle un compte ? » permettrait de sonder les membres).
 */
export const MEMBER_COOKIE = "baobab_membre";

/** Cookie de session posé par « Découvrir LE BAOBAB » : laisse un membre parcourir l'accueil. */
export const DISCOVER_COOKIE = "baobab_decouverte";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function markAsMember() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MEMBER_COOKIE}=1; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
}
