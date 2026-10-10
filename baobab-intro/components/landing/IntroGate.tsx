"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BaobabIntro } from "@/components/baobab/BaobabIntro";
import { INTRO_SEEN_STORAGE_KEY, LANDING_ROOT_ID, PLAY_INTRO_EVENT } from "./intro-gate-script";
import styles from "./IntroGate.module.css";

/** Temps pendant lequel le logo final reste affiché avant de dévoiler la page. */
const HOLD_AFTER_COMPLETE_MS = 450;
/** Doit correspondre à la transition d'opacité de .overlay[data-phase="leaving"]. */
const LEAVE_DURATION_MS = 650;

type GatePhase = "idle" | "playing" | "leaving";

function setLandingInert(inert: boolean) {
  const landing = document.getElementById(LANDING_ROOT_ID);
  if (landing) landing.inert = inert;
}

/**
 * Affiche la cinématique d'ouverture (inchangée) par-dessus la landing :
 *  - automatiquement à la première visite de la session (décision prise avant
 *    l'affichage par intro-gate-script.ts, donc sans clignotement) ;
 *  - à la demande, via le bouton « Voir l'intro ».
 * À la fin (ou sur « Passer l'intro » / Échap), le voile s'efface en fondu et
 * la cascade d'apparition de la page démarre.
 */
export function IntroGate() {
  const [phase, setPhase] = useState<GatePhase>("idle");
  const [runId, setRunId] = useState(0);
  const [fromReplay, setFromReplay] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const holdTimerRef = useRef<number | undefined>(undefined);

  const play = useCallback((isReplay: boolean) => {
    window.clearTimeout(holdTimerRef.current);
    returnFocusRef.current = isReplay ? (document.activeElement as HTMLElement | null) : null;
    document.documentElement.dataset.intro = "play";
    setLandingInert(true);
    setFromReplay(isReplay);
    setRunId((previous) => previous + 1);
    setPhase("playing");
  }, []);

  const leave = useCallback(() => {
    window.clearTimeout(holdTimerRef.current);
    document.documentElement.dataset.intro = "done";
    setLandingInert(false);
    try {
      sessionStorage.setItem(INTRO_SEEN_STORAGE_KEY, "1");
    } catch {
      // stockage indisponible (navigation privée stricte) : la cinématique rejouera, sans gravité
    }
    setPhase((current) => (current === "playing" ? "leaving" : current));
  }, []);

  // Lecture automatique décidée avant l'hydratation + écoute du bouton « Voir l'intro ».
  useEffect(() => {
    if (document.documentElement.dataset.intro === "play") play(false);
    const onPlayRequest = () => play(true);
    window.addEventListener(PLAY_INTRO_EVENT, onPlayRequest);
    return () => {
      window.removeEventListener(PLAY_INTRO_EVENT, onPlayRequest);
      window.clearTimeout(holdTimerRef.current);
    };
  }, [play]);

  // Pendant la lecture : Échap pour passer. La page étant inerte, Tab mène directement à « Passer l'intro ».
  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, leave]);

  // Fin du fondu : on démonte la cinématique et on rend le focus.
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => {
      setPhase("idle");
      returnFocusRef.current?.focus({ preventScroll: true });
    }, LEAVE_DURATION_MS + 50);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const handleComplete = useCallback(() => {
    holdTimerRef.current = window.setTimeout(leave, HOLD_AFTER_COMPLETE_MS);
  }, [leave]);

  return (
    <div
      className={styles.overlay}
      data-phase={phase}
      data-entry={fromReplay ? "replay" : "first-visit"}
      aria-hidden={phase === "idle" ? true : undefined}
    >
      {phase !== "idle" && (
        <>
          <BaobabIntro key={runId} onComplete={handleComplete} />
          <button type="button" className={styles.skip} onClick={leave}>
            Passer l&apos;intro
          </button>
        </>
      )}
    </div>
  );
}

