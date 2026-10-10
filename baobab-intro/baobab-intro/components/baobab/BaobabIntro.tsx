"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type Ref,
} from "react";
import { BAOBAB_INTRO_CONFIG, TOTAL_DURATION_MS, segment, timing } from "./animation-config";
import { BaobabTree } from "./BaobabTree";
import { BaobabWordmark } from "./BaobabWordmark";
import { STRIKE_TIME } from "./LightningEffect";
import { TREE_PUSH_KEYFRAMES_NAME, buildTreePushKeyframes } from "./push-curve";
import styles from "./BaobabIntro.module.css";

export interface BaobabIntroHandle {
  /** Relance la cinématique depuis 0 s. */
  replay: () => void;
}

export interface BaobabIntroProps {
  /** Appelé une seule fois, quand le logo final est en place (7 s en mode normal). */
  onComplete?: () => void;
  /** Classe CSS supplémentaire sur le conteneur (taille, position, z-index…). */
  className?: string;
  /** Démarrage automatique au montage (vrai par défaut). Sinon : ref.current.replay(). */
  autoPlay?: boolean;
  /** Respecter la préférence système « réduire les animations » (vrai par défaut). */
  respectReducedMotion?: boolean;
  ref?: Ref<BaobabIntroHandle>;
}

type IntroMode = "idle" | "playing" | "reduced";

const { colors, background, waves, layout, reducedMotion } = BAOBAB_INTRO_CONFIG;
const TREE_PUSH_KEYFRAMES = buildTreePushKeyframes();

/** Variables CSS dérivées de la configuration, posées sur le conteneur. */
const ROOT_VARIABLES = {
  "--logo-h": layout.logoHeight,
  "--gap-ratio": String(layout.gapRatio),
  "--wordmark-ratio": String(layout.wordmarkSizeRatio),
  "--wordmark-em": String(layout.wordmarkWidthEm),
  "--wordmark-travel-ratio": String(layout.wordmarkTravelRatio),
  "--lockup-x": layout.lockupOffsetX,
  "--lockup-y": layout.lockupOffsetY,
  "--wordmark-color": colors.wordmark,
  "--bg-day": background.day,
  "--bg-day-glow": background.dayGlow,
  "--bg-night": background.night,
  "--bg-night-glow": background.nightGlow,
  "--bg-flash": background.flash,
  "--flash-opacity": String(background.flashOpacity),
  "--waves-final-opacity": String(waves.finalLayerOpacity),
  "--tree-push-name": TREE_PUSH_KEYFRAMES_NAME,
  "--reduced-fade": `${reducedMotion.fadeInMs}ms`,
} as CSSProperties;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Attend que la police du nom soit prête (au plus 800 ms) pour mesurer le texte juste. */
function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 800)),
  ]);
}

/**
 * Cinématique d'ouverture LE BAOBAB.
 * Toutes les animations sont des animations CSS pilotées par le temps et
 * synchronisées sur une seule origine : le montage de la scène (clé `runId`).
 */
export function BaobabIntro({
  onComplete,
  className,
  autoPlay = true,
  respectReducedMotion = true,
  ref,
}: BaobabIntroProps) {
  const [mode, setMode] = useState<IntroMode>("idle");
  const [runId, setRunId] = useState(0);
  const [completedRun, setCompletedRun] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLParagraphElement>(null);
  const onCompleteRef = useRef(onComplete);
  const completedRunRef = useRef(-1);
  const startTokenRef = useRef(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = useCallback(() => {
    const token = ++startTokenRef.current;
    void waitForFonts().then(() => {
      if (token !== startTokenRef.current) return; // démarrage annulé ou remplacé
      requestAnimationFrame(() => {
        if (token !== startTokenRef.current) return;
        setMode(respectReducedMotion && prefersReducedMotion() ? "reduced" : "playing");
        setRunId((previous) => previous + 1);
      });
    });
  }, [respectReducedMotion]);

  useImperativeHandle(ref, () => ({ replay: start }), [start]);

  useEffect(() => {
    if (autoPlay) start();
    return () => {
      startTokenRef.current += 1; // annule un démarrage en attente au démontage
    };
  }, [autoPlay, start]);

  const finish = useCallback(() => {
    if (completedRunRef.current === runId) return;
    completedRunRef.current = runId;
    setCompletedRun(runId);
    onCompleteRef.current?.();
  }, [runId]);

  // Filet de sécurité : si l'événement de fin n'arrive pas (onglet masqué, etc.).
  useEffect(() => {
    if (mode === "idle") return;
    const delay = mode === "reduced" ? reducedMotion.fadeInMs + reducedMotion.holdMs : TOTAL_DURATION_MS + 1500;
    const timer = window.setTimeout(finish, delay);
    return () => window.clearTimeout(timer);
  }, [mode, runId, finish]);

  // Mesure réelle de la largeur du nom pour centrer parfaitement l'arbre seul.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const wordmark = wordmarkRef.current;
    if (!root || !wordmark || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const lockup = wordmark.parentElement;
      const gap = lockup ? parseFloat(getComputedStyle(lockup).columnGap) || 0 : 0;
      if (wordmark.offsetWidth > 0) {
        root.style.setProperty("--tree-shift", `${(wordmark.offsetWidth + gap) / 2}px`);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wordmark);
    observer.observe(root);
    return () => observer.disconnect();
  }, [runId]);

  const handleWordmarkArrived = (event: AnimationEvent<HTMLParagraphElement>) => {
    if (event.target === event.currentTarget && mode === "playing") finish();
  };

  const wordmarkWindow = segment("wordmark");

  return (
    <div
      ref={rootRef}
      className={[styles.root, styles[mode], className].filter(Boolean).join(" ")}
      style={ROOT_VARIABLES}
      data-baobab-intro=""
      data-state={mode !== "idle" && completedRun === runId ? "complete" : mode}
      data-total-ms={TOTAL_DURATION_MS}
      aria-label="LE BAOBAB"
      role="img"
    >
      <style>{TREE_PUSH_KEYFRAMES}</style>

      {/* La clé runId remonte la scène : c'est la seule façon de relancer les animations. */}
      <div key={runId} className={styles.layer}>
        <div className={`${styles.layer} ${styles.backgroundDay}`} />
        <div
          className={`${styles.layer} ${styles.backgroundNight} ${styles.animated}`}
          style={timing(STRIKE_TIME.start + STRIKE_TIME.duration + 50, 280)}
        />

        <div className={styles.lockup}>
          <div
            className={`${styles.treeSlot} ${styles.animated}`}
            style={timing(wordmarkWindow.start, wordmarkWindow.duration)}
          >
            <BaobabTree />
          </div>
          <BaobabWordmark ref={wordmarkRef} onArrived={handleWordmarkArrived} />
        </div>

        <div
          className={`${styles.layer} ${styles.screenFlash} ${styles.animated}`}
          style={timing(STRIKE_TIME.start + STRIKE_TIME.duration - 10, 720)}
        />
      </div>
    </div>
  );
}

export default BaobabIntro;
