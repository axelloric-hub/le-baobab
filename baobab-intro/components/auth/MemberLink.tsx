import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTES } from "@/lib/routes";

/**
 * Action réservée aux membres (rejoindre un groupe, publier, réagir…) : conduit à la connexion.
 * `to="register"` pour les appels à créer un compte (« Rejoindre », « Créer mon profil »).
 * Garde l'apparence du bouton d'origine (même className).
 */
export function MemberLink({
  className,
  children,
  to = "login",
  ariaHidden,
}: {
  className?: string;
  children: ReactNode;
  to?: "login" | "register";
  ariaHidden?: boolean;
}) {
  return (
    <Link
      href={to === "register" ? ROUTES.register : ROUTES.login}
      className={className}
      data-auth-link={to}
      aria-hidden={ariaHidden || undefined}
      tabIndex={ariaHidden ? -1 : undefined}
    >
      {children}
    </Link>
  );
}
