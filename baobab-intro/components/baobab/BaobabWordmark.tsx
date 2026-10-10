import localFont from "next/font/local";
import type { AnimationEvent, Ref } from "react";
import { segment, timing } from "./animation-config";
import { WORDMARK_EASING } from "./push-curve";
import styles from "./BaobabIntro.module.css";

/**
 * Police locale (Outfit Bold, licence SIL OFL) : aucune requête réseau à l'exécution.
 * C'est la police libre la plus proche du lettrage du logo officiel.
 */
const wordmarkFont = localFont({
  src: "./fonts/Outfit-Bold.woff2",
  weight: "700",
  display: "block",
  preload: true,
});

interface BaobabWordmarkProps {
  ref?: Ref<HTMLParagraphElement>;
  onArrived?: (event: AnimationEvent<HTMLParagraphElement>) => void;
}

/** Phase 7 — le nom « LE BAOBAB » glisse depuis la droite. */
export function BaobabWordmark({ ref, onArrived }: BaobabWordmarkProps) {
  const phaseWindow = segment("wordmark");
  return (
    <p
      ref={ref}
      className={`${styles.wordmark} ${styles.animated} ${wordmarkFont.className}`}
      style={{
        ...timing(phaseWindow.start, phaseWindow.duration),
        animationTimingFunction: `cubic-bezier(${WORDMARK_EASING.join(", ")})`,
      }}
      onAnimationEnd={onArrived}
    >
      LE BAOBAB
    </p>
  );
}
