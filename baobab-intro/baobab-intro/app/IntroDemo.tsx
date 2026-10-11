"use client";

import { useEffect, useRef } from "react";
import { BaobabIntro, type BaobabIntroHandle } from "@/components/baobab/BaobabIntro";
import { TOTAL_DURATION_MS } from "@/components/baobab/animation-config";

/**
 * Fige toutes les animations de la cinématique à un instant précis (en ms).
 * Utile pour inspecter une phase ou capturer une vidéo image par image : ?t=3450
 */
function seekIntro(timeMs: number) {
  const root = document.querySelector<HTMLElement>("[data-baobab-intro]");
  if (!root) return;
  for (const animation of root.getAnimations({ subtree: true })) {
    animation.pause();
    animation.currentTime = timeMs;
  }
}

declare global {
  interface Window {
    /** Exposé pour les tests et la capture : window.__baobabSeek(ms) */
    __baobabSeek?: (timeMs: number) => void;
  }
}

/**
 * Démo de présentation :
 *  - lecture automatique au chargement ;
 *  - touche R, Espace ou Entrée, ou un clic : relancer la cinématique ;
 *  - ?t=4200 dans l'URL : afficher l'image figée à 4,2 s.
 */
export function IntroDemo() {
  const introRef = useRef<BaobabIntroHandle>(null);

  useEffect(() => {
    window.__baobabSeek = seekIntro;
    const frozenAt = new URLSearchParams(window.location.search).get("t");
    let frozenTimer: number | undefined;
    if (frozenAt !== null) {
      const time = Math.min(Number(frozenAt) || 0, TOTAL_DURATION_MS);
      // laisse le temps à la scène de démarrer, puis la fige
      frozenTimer = window.setTimeout(() => seekIntro(time), 1200);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (["r", "R", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        introRef.current?.replay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(frozenTimer);
      delete window.__baobabSeek;
    };
  }, []);

  return (
    <main onClick={() => introRef.current?.replay()} style={{ cursor: "default" }}>
      <BaobabIntro
        ref={introRef}
        onComplete={() => {
          // Dans l'application réelle : afficher l'écran d'accueil ou de connexion ici.
          console.info("[LE BAOBAB] cinématique terminée");
        }}
      />
    </main>
  );
}
