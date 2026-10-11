/**
 * Membres qui reviennent : l'accueil les envoie directement à la connexion.
 *
 * Le cookie « baobab_membre » est posé par le navigateur après une inscription ou une
 * connexion réussie (lib/auth/member-cookie.ts). On suppose alors que la personne connaît
 * déjà LE BAOBAB : pas de présentation, direction /connexion (qui elle-même renvoie vers
 * l'espace membre si la session est encore valide).
 *
 * « Découvrir LE BAOBAB » (/?decouvrir=1) laisse un membre parcourir l'accueil pendant
 * toute la session du navigateur.
 */
import { NextResponse, type NextRequest } from "next/server";
import { DISCOVER_COOKIE, MEMBER_COOKIE } from "@/lib/auth/member-cookie";

/** Préchargement automatique d'un lien par Next.js : ce n'est pas une vraie visite. */
function isPrefetch(request: NextRequest) {
  return request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.get("decouvrir") === "1") {
    if (isPrefetch(request)) return NextResponse.next();
    const response = NextResponse.next();
    response.cookies.set(DISCOVER_COOKIE, "1", { path: "/", sameSite: "lax" }); // cookie de session
    return response;
  }
  const isMember = request.cookies.get(MEMBER_COOKIE)?.value === "1";
  const isDiscovering = request.cookies.get(DISCOVER_COOKIE)?.value === "1";
  if (isMember && !isDiscovering) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
