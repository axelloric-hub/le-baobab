"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { socialApi } from "@/features/social/api";
import { markStatusViewed } from "@/features/social/hooks";
import { safeUrl } from "@/features/social/payload";
import type { Status } from "@/features/social/types";
import { relativeTime } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { AudioIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, ExternalIcon, FileIcon, MuteIcon, PauseIcon, PlayIcon, VolumeIcon } from "../ui/icons";
import styles from "./Status.module.css";
import { STATUS_EMOJIS, durationOf, readableOn, safeBackground, type StatusGroup } from "./status-utils";

interface StatusViewerProps {
  groups: StatusGroup[];
  startGroup: number;
  me: string;
  onClose: () => void;
}

const HOLD_MS = 220;

/**
 * Visionneuse plein écran des statuts.
 *  - toucher à droite / gauche : suivant / précédent ; maintenir : pause ; glisser vers le bas : fermer ;
 *  - clavier : ← →, Espace (pause), Échap (fermer) ;
 *  - chaque statut affiché est marqué « vu » (sauf les miens).
 */
export function StatusViewer({ groups, startGroup, me, onClose }: StatusViewerProps) {
  const client = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const [itemIndex, setItemIndex] = useState(() => Math.max(0, groups[startGroup]?.items.findIndex((s) => !s.viewed) ?? 0));
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [reacted, setReacted] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(0);
  const pointer = useRef<{ x: number; y: number; t: number; timer?: number } | null>(null);

  const group = groups[groupIndex];
  const status: Status | undefined = group?.items[itemIndex];
  const isMine = group?.author.username === me;
  const hasMedia = status?.kind === "video" || status?.kind === "audio";
  const running = !paused && !held && ready;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Statut affiché : marqué « vu » une seule fois (cache local + serveur).
  useEffect(() => {
    if (!status || isMine || status.viewed) return;
    markStatusViewed(client, status.id);
    socialApi.viewStatus(status.id).catch(() => {});
  }, [status, isMine, client]);

  // Nouveau statut : on attend que son contenu soit prêt avant de lancer le minuteur.
  useEffect(() => {
    setMediaProgress(0);
    setReady(!status || status.kind === "text" || status.kind === "link" || status.kind === "document");
  }, [status]);

  const next = useCallback(() => {
    if (!group) return;
    if (itemIndex < group.items.length - 1) setItemIndex(itemIndex + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setItemIndex(Math.max(0, groups[groupIndex + 1].items.findIndex((s) => !s.viewed)));
    } else onClose();
  }, [group, groupIndex, groups, itemIndex, onClose]);

  const prev = useCallback(() => {
    if (itemIndex > 0) setItemIndex(itemIndex - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setItemIndex(groups[groupIndex - 1].items.length - 1);
    } else setItemIndex(0);
  }, [groupIndex, groups, itemIndex]);

  const jumpGroup = (delta: 1 | -1) => {
    const target = groupIndex + delta;
    if (target < 0 || target >= groups.length) return;
    setGroupIndex(target);
    setItemIndex(0);
  };

  // Lecture / pause des médias synchronisée avec l'état de la visionneuse.
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !hasMedia) return;
    if (!paused && !held) media.play().catch(() => setMuted(true));
    else media.pause();
  }, [paused, held, hasMedia, status]);

  const react = (emoji: string) => {
    if (!status) return;
    setReacted((map) => ({ ...map, [status.id]: emoji }));
    setSent((n) => n + 1);
    socialApi.reactStatus(status.id, emoji).catch(() =>
      setReacted((map) => {
        const copy = { ...map };
        delete copy[status.id];
        return copy;
      }),
    );
  };

  if (!group || !status) return null;

  const background = safeBackground(status.style);
  const name = group.author.display_name || group.author.username;
  const link = safeUrl(status.link_url);
  const storyStyle = { "--story-bg": status.kind === "text" || status.kind === "link" ? background : "#000", "--story-fg": readableOn(status.kind === "text" || status.kind === "link" ? background : "#000000") } as CSSProperties;

  return (
    <dialog
      ref={dialogRef}
      className={styles.viewer}
      aria-label={`Statuts de ${name}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") prev();
        else if (e.key === " " && !(e.target as HTMLElement).closest("button,a")) {
          e.preventDefault();
          setPaused((p) => !p);
        }
      }}
    >
      <div className={styles.stage}>
        <button type="button" className={styles.groupNav} onClick={() => jumpGroup(-1)} disabled={groupIndex === 0} aria-label="Personne précédente">
          <ChevronLeftIcon />
        </button>

        <div
          key={group.author.username}
          className={styles.story}
          data-switch
          style={storyStyle}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button,a,video[controls]")) return;
            const timer = window.setTimeout(() => setHeld(true), HOLD_MS);
            pointer.current = { x: e.clientX, y: e.clientY, t: Date.now(), timer };
          }}
          onPointerUp={(e) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start) return;
            window.clearTimeout(start.timer);
            if (held) {
              setHeld(false);
              return;
            }
            if (e.clientY - start.y > 90) return onClose(); // glisser vers le bas
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width * 0.32) prev();
            else next();
          }}
          onPointerCancel={() => {
            if (pointer.current) window.clearTimeout(pointer.current.timer);
            pointer.current = null;
            setHeld(false);
          }}
        >
          <div className={styles.bars} aria-hidden="true">
            {group.items.map((item, i) => {
              const state = i < itemIndex ? "done" : i > itemIndex ? "todo" : hasMedia ? "media" : "active";
              return (
                <span key={item.id} className={styles.bar} data-state={state}>
                  <span
                    key={i === itemIndex ? `${item.id}-active` : item.id}
                    style={
                      i === itemIndex
                        ? ({ "--d": `${durationOf(item)}ms`, "--play": running ? "running" : "paused", "--p": hasMedia ? mediaProgress : 0 } as CSSProperties)
                        : undefined
                    }
                    onAnimationEnd={i === itemIndex && !hasMedia ? next : undefined}
                  />
                </span>
              );
            })}
          </div>

          <header className={styles.storyHead}>
            <Avatar name={name} src={group.author.avatar_url} size={36} className={styles.storyAvatar} />
            <span className={styles.storyWho}>
              <span className={styles.storyName}>{isMine ? "Mon statut" : name}</span>
              <span className={styles.storyTime}>
                <time dateTime={status.created_at}>{relativeTime(status.created_at)}</time>
              </span>
            </span>
            {hasMedia && (
              <button type="button" className={styles.storyButton} onClick={() => setMuted((m) => !m)} aria-label={muted ? "Activer le son" : "Couper le son"}>
                {muted ? <MuteIcon /> : <VolumeIcon />}
              </button>
            )}
            <button type="button" className={styles.storyButton} onClick={() => setPaused((p) => !p)} aria-label={paused ? "Reprendre" : "Mettre en pause"}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button type="button" className={styles.storyButton} onClick={onClose} aria-label="Fermer" autoFocus>
              <CloseIcon />
            </button>
          </header>

          <div className={styles.content} aria-live="polite">
            {status.kind === "text" && (
              <p className={styles.text} data-long={status.body.length > 180 || undefined}>
                {status.body}
              </p>
            )}
            {status.kind === "image" && status.media_url && (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée
              <img key={status.id} className={styles.media} src={status.media_url} alt={status.body || `Statut de ${name}`} onLoad={() => setReady(true)} onError={() => setReady(true)} />
            )}
            {status.kind === "video" && status.media_url && (
              <video
                key={status.id}
                ref={mediaRef}
                className={styles.media}
                src={status.media_url}
                playsInline
                autoPlay
                muted={muted}
                onCanPlay={() => setReady(true)}
                onTimeUpdate={(e) => setMediaProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
                onEnded={next}
                onError={() => setReady(true)}
              />
            )}
            {status.kind === "audio" && status.media_url && (
              <div className={styles.audio}>
                <span className={styles.audioDisc} aria-hidden="true">
                  <AudioIcon />
                </span>
                <audio
                  key={status.id}
                  ref={mediaRef}
                  src={status.media_url}
                  autoPlay
                  muted={muted}
                  onCanPlay={() => setReady(true)}
                  onTimeUpdate={(e) => setMediaProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
                  onEnded={next}
                  onError={() => setReady(true)}
                />
              </div>
            )}
            {(status.kind === "link" || status.kind === "document") && (
              <div className={styles.linkBox}>
                {status.body && <p>{status.body}</p>}
                {link && (
                  <a className={styles.linkButton} href={link} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={() => setPaused(true)}>
                    <ExternalIcon aria-hidden="true" />
                    <span>{new URL(link).hostname.replace(/^www\./, "")}</span>
                  </a>
                )}
                {status.kind === "document" && status.media_url && (
                  <a className={styles.linkButton} href={status.media_url} target="_blank" rel="noopener noreferrer" onClick={() => setPaused(true)}>
                    <FileIcon aria-hidden="true" />
                    <span>Ouvrir le document</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {status.body && (status.kind === "image" || status.kind === "video" || status.kind === "audio") && <p className={styles.caption}>{status.body}</p>}

          {!isMine && (
            <div className={styles.reactions} role="group" aria-label="Réagir au statut">
              {STATUS_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.reaction}
                  aria-pressed={reacted[status.id] === emoji}
                  aria-label={`Réagir avec ${emoji}`}
                  onClick={() => react(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {sent > 0 && (
            <span key={sent} className={styles.sent} role="status">
              Réaction envoyée
            </span>
          )}
        </div>

        <button type="button" className={styles.groupNav} onClick={() => jumpGroup(1)} disabled={groupIndex === groups.length - 1} aria-label="Personne suivante">
          <ChevronRightIcon />
        </button>
      </div>
    </dialog>
  );
}
