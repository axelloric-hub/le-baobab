"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactionType } from "@/features/social/types";
import { ThumbIcon } from "../ui/icons";
import { REACTIONS, reactionOf } from "../ui/reactions";
import styles from "./Post.module.css";

interface ReactionButtonProps {
  value: ReactionType | null;
  onChange: (type: ReactionType | null) => void;
  disabled?: boolean;
}

const HOLD_MS = 450;

/**
 * Bouton « J'aime » + sélecteur des 6 réactions.
 *  - clic : J'aime / retirer sa réaction ;
 *  - survol prolongé (souris) ou appui long (tactile) : sélecteur ;
 *  - clavier : flèche haut ouvre le sélecteur, flèches gauche/droite, Échap ferme.
 */
export function ReactionButton({ value, onChange, disabled }: ReactionButtonProps) {
  const [open, setOpen] = useState(false);
  const viaKeyboard = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = reactionOf(value);
  const items = () => Array.from(wrapRef.current?.querySelectorAll<HTMLButtonElement>("[data-reaction]") ?? []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Ouvert au clavier : le focus passe sur la première réaction.
  useEffect(() => {
    if (open && viaKeyboard.current) items()[0]?.focus();
    viaKeyboard.current = false;
  }, [open]);

  const choose = (type: ReactionType) => {
    setOpen(false);
    onChange(value === type ? null : type);
  };

  return (
    <div
      ref={wrapRef}
      className={styles.reactWrap}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || disabled) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(true), HOLD_MS);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(false), 300);
      }}
      onKeyDown={(e) => {
        if (!open) return;
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          (wrapRef.current?.querySelector("[data-main]") as HTMLButtonElement | null)?.focus();
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          list[(index + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]?.focus();
        }
      }}
    >
      {open && (
        <div className={styles.picker} role="group" aria-label="Choisir une réaction">
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              type="button"
              data-reaction
              className={styles.pickerItem}
              data-label={reaction.label}
              aria-label={reaction.label}
              aria-pressed={value === reaction.type}
              onClick={() => choose(reaction.type)}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        data-main
        className={styles.action}
        aria-pressed={Boolean(current)}
        aria-label={current ? `Votre réaction : ${current.label}. Retirer` : "J'aime"}
        aria-keyshortcuts="ArrowUp"
        title="Maintenir pour choisir une réaction"
        disabled={disabled}
        style={current ? ({ "--reaction-color": current.color } as React.CSSProperties) : undefined}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          longPressed.current = false;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            setOpen(true);
            navigator.vibrate?.(10);
          }, HOLD_MS);
        }}
        onPointerUp={(e) => e.pointerType !== "mouse" && window.clearTimeout(timer.current)}
        onPointerCancel={() => window.clearTimeout(timer.current)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          setOpen(false);
          onChange(current ? null : "like");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" && !open) {
            e.preventDefault();
            viaKeyboard.current = true;
            setOpen(true);
          }
        }}
      >
        {current ? (
          <span key={current.type} className={styles.actionEmoji} aria-hidden="true">
            {current.emoji}
          </span>
        ) : (
          <ThumbIcon />
        )}
        <span className={styles.actionLabel}>{current ? current.label : "J'aime"}</span>
      </button>
    </div>
  );
}
