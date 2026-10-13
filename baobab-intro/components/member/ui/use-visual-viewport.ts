"use client";

import { useEffect } from "react";

/**
 * Suit la zone réellement visible de l'écran (visualViewport). Sur iPhone et Android, le clavier
 * ne redimensionne pas la page : sans ce suivi, il recouvre le bas de la fenêtre. Les variables
 * --vv-top / --vv-height / --vv-bottom placent la fenêtre exactement au-dessus du clavier.
 */
export function useVisualViewport(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!dialog || !active || !vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        dialog.style.setProperty("--vv-top", `${vv.offsetTop}px`);
        dialog.style.setProperty("--vv-height", `${vv.height}px`);
        dialog.style.setProperty("--vv-bottom", `${bottom}px`);
        // Clavier ouvert : la zone visible est nettement plus petite que la fenêtre.
        dialog.toggleAttribute("data-keyboard", window.innerHeight - vv.height > 120);
        // Le champ actif reste visible quand le clavier apparaît ou change de taille.
        const active = document.activeElement as HTMLElement | null;
        if (active && dialog.contains(active) && active.matches("input, textarea, select, [contenteditable]")) {
          active.scrollIntoView({ block: "nearest" });
        }
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [ref, active]);
}

