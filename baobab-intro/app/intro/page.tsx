import type { Metadata } from "next";
import { IntroDemo } from "./IntroDemo";

export const metadata: Metadata = {
  title: "LE BAOBAB — Cinématique d'ouverture",
};

/**
 * Page de présentation de la cinématique seule (pour filmer l'écran) :
 * plein écran, lecture automatique, R / Espace / clic pour relancer, ?t=ms pour figer.
 */
export default function IntroPage() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#050b18" }}>
      <IntroDemo />
    </div>
  );
}
