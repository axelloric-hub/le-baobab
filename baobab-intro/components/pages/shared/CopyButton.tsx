"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, LinkIcon } from "@/components/landing/icons";

interface CopyButtonProps {
  /** Texte à copier ; sans valeur, copie l'adresse de la page courante. */
  text?: string;
  label: string;
  className: string;
  iconOnly?: boolean;
}

/** Copie dans le presse-papiers, avec confirmation visible et annoncée aux lecteurs d'écran. */
export function CopyButton({ text, label, className, iconOnly = false }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? window.location.href);
      setState("done");
    } catch {
      setState("error");
    }
  };

  const feedback = state === "done" ? "Copié !" : state === "error" ? "Copie impossible" : "";
  const Icon = state === "done" ? CheckIcon : text === undefined ? LinkIcon : CopyIcon;

  return (
    <>
      <button type="button" className={className} onClick={copy} data-state={state} title={label} aria-label={iconOnly ? label : undefined}>
        <Icon aria-hidden="true" />
        {!iconOnly && <span aria-hidden={feedback ? true : undefined}>{feedback || label}</span>}
        {!iconOnly && feedback && <span className="bb-visually-hidden">{label}</span>}
      </button>
      <span className="bb-visually-hidden" role="status">
        {feedback}
      </span>
    </>
  );
}
