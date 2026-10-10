"use client";

import type { ReactNode } from "react";
import { PLAY_INTRO_EVENT } from "./intro-gate-script";

/**
 * « Voir l'intro » / « Revoir l'intro » : rejoue la cinématique d'ouverture par-dessus la page.
 * C'est la seule démonstration réellement disponible dans le projet aujourd'hui.
 * Quand une vraie démo produit existera, remplacer ce bouton par un lien.
 */
export function DemoButton({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new CustomEvent(PLAY_INTRO_EVENT))}>
      {children}
      {/* Précision pour les lecteurs d'écran ; le libellé visible reste le début du nom accessible. */}
      <span className="bb-visually-hidden"> (rejoue la cinématique d&apos;ouverture)</span>
    </button>
  );
}
