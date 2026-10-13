"use client";

import { memo, useRef, useState } from "react";
import { CodeBlock } from "@/components/pages/shared/CodeBlock";
import type { Message } from "@/features/messaging/types";
import { Avatar } from "../ui/Avatar";
import { RichBody } from "../post/rich-text";
import { CheckIcon, ClockIcon, CopyIcon, DoubleCheckIcon, FileIcon, MoreIcon, PenIcon, ReplyIcon, SmileIcon, TrashIcon } from "../ui/icons";
import { Menu, type MenuEntry } from "../ui/Menu";
import { kindLabel, fileSize, timeOf } from "./labels";
import styles from "./Messages.module.css";

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageRowProps {
  message: Message;
  mine: boolean;
  /** Premier message d'un groupe de bulles du même auteur (nom, avatar, coin). */
  first: boolean;
  /** Dernier du groupe : l'avatar de l'autre s'affiche à côté. */
  last: boolean;
  showSender: boolean;
  /** Message cité (réponse), s'il est chargé. */
  quoted: Message | null | undefined;
  /** Conversation directe : l'autre a lu jusqu'à ce numéro (null = inconnu ou masqué). */
  readSeq: number | null | undefined;
  highlight: boolean;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message, forEveryone: boolean) => void;
  onRetry: (message: Message) => void;
  onJump: (messageId: string) => void;
  onCopy: (message: Message) => void;
}

const SWIPE_TRIGGER = 48;

function Status({ message, readSeq }: { message: Message; readSeq: number | null | undefined }) {
  if (message.local?.state === "sending")
    return (
      <span data-state="sending" title="Envoi…" aria-label="Envoi en cours">
        <ClockIcon />
      </span>
    );
  if (message.local?.state === "failed") return null;
  if (readSeq != null && readSeq >= message.seq)
    return (
      <span data-state="read" title="Lu" aria-label="Lu">
        <DoubleCheckIcon />
      </span>
    );
  return (
    <span data-state="sent" title="Envoyé" aria-label="Envoyé">
      <CheckIcon />
    </span>
  );
}

function Attachments({ message }: { message: Message }) {
  if (message.attachments.length === 0) return null;
  return (
    <div className={styles.attachments}>
      {message.attachments.map((a) => {
        const type = a.content_type.split("/")[0];
        if (type === "image")
          return (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir l'image ${a.filename}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée */}
              <img className={styles.attImage} src={a.url} alt={a.filename} loading="lazy" />
            </a>
          );
        if (type === "video") return <video key={a.url} className={styles.attVideo} src={a.url} controls preload="metadata" aria-label={a.filename} />;
        if (type === "audio") return <audio key={a.url} src={a.url} controls preload="none" aria-label={a.filename} />;
        return (
          <a key={a.url} className={styles.attFile} href={a.url} target="_blank" rel="noopener noreferrer" download={a.filename}>
            <FileIcon aria-hidden="true" />
            <span>
              {a.filename}
              <small>{fileSize(a.size_bytes)}</small>
            </span>
          </a>
        );
      })}
    </div>
  );
}

function MessageRowImpl(props: MessageRowProps) {
  const { message, mine, first, last, showSender, quoted, readSeq, highlight, onReply, onReact, onEdit, onDelete, onRetry, onJump, onCopy } = props;
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const gesture = useRef<{ x: number; y: number; timer?: number; swiping: boolean } | null>(null);
  const name = message.sender?.display_name || message.sender?.username || "";
  const local = Boolean(message.local);
  const reactions = Object.entries(message.reactions);

  const menu: MenuEntry[] = [
    { label: "Répondre", icon: <ReplyIcon />, onSelect: () => onReply(message) },
    ...(message.body ? [{ label: "Copier le texte", icon: <CopyIcon />, onSelect: () => onCopy(message) }] : []),
    ...(mine && message.kind === "text" ? [{ label: "Modifier", icon: <PenIcon />, onSelect: () => onEdit(message) }] : []),
    { kind: "separator" as const },
    { label: "Supprimer pour moi", icon: <TrashIcon />, tone: "danger" as const, onSelect: () => onDelete(message, false) },
    ...(mine ? [{ label: "Supprimer pour tous", icon: <TrashIcon />, tone: "danger" as const, onSelect: () => onDelete(message, true) }] : []),
  ];

  // Mobile : glisser la bulle vers la droite = répondre ; appui long = actions.
  const pointer = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" || local || (e.target as HTMLElement).closest("a, button, video, audio")) return;
      const timer = window.setTimeout(() => {
        setToolsOpen(true);
        navigator.vibrate?.(10);
      }, 480);
      gesture.current = { x: e.clientX, y: e.clientY, timer, swiping: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const moveX = e.clientX - g.x;
      const moveY = Math.abs(e.clientY - g.y);
      if (Math.abs(moveX) > 8 || moveY > 8) window.clearTimeout(g.timer);
      if (moveY > 24 && !g.swiping) {
        gesture.current = null;
        setDx(0);
        return;
      }
      if (moveX > 8) {
        g.swiping = true;
        setDx(Math.min(64, moveX));
      }
    },
    onPointerUp: () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      window.clearTimeout(g.timer);
      if (g.swiping && dx >= SWIPE_TRIGGER) {
        navigator.vibrate?.(8);
        onReply(message);
      }
      setDx(0);
    },
    onPointerCancel: () => {
      if (gesture.current) window.clearTimeout(gesture.current.timer);
      gesture.current = null;
      setDx(0);
    },
  };

  return (
    <div
      className={styles.row}
      data-mine={mine || undefined}
      data-first={first || undefined}
      data-highlight={highlight || undefined}
      data-tools={toolsOpen || undefined}
      id={`message-${message.id}`}
      onMouseLeave={() => setEmojiOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setToolsOpen(false);
          setEmojiOpen(false);
        }
      }}
      {...pointer}
    >
      {dx > 0 && (
        <span className={styles.swipeIcon} style={{ opacity: dx / SWIPE_TRIGGER }} aria-hidden="true">
          <ReplyIcon />
        </span>
      )}
      {!mine && <span className={styles.rowAvatar}>{last && message.sender && <Avatar name={name} src={message.sender.avatar_url} size={28} />}</span>}
      <div className={styles.bubbleCol} style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        {showSender && first && !mine && <span className={styles.senderName}>{name}</span>}
        <div className={styles.bubble}>
          {message.reply_to && (
            <button type="button" className={styles.quote} onClick={() => onJump(message.reply_to!)}>
              <strong>{quoted ? quoted.sender?.display_name || quoted.sender?.username || "Message" : "Réponse à"}</strong>
              <span>{quoted ? quoted.body || kindLabel(quoted.kind, quoted.attachments.length) : "un message plus ancien"}</span>
            </button>
          )}
          <Attachments message={message} />
          {message.kind === "code" ? (
            <div className={styles.codeMsg}>
              <CodeBlock code={message.body} language={typeof message.metadata.language === "string" ? message.metadata.language : undefined} copyable compact />
            </div>
          ) : (
            message.body && <RichBody text={message.body} />
          )}
          <span className={styles.bubbleMeta}>
            {message.edited_at && <span className={styles.edited}>modifié ·</span>}
            <time dateTime={message.created_at}>{timeOf(message.created_at)}</time>
            {mine && <Status message={message} readSeq={readSeq} />}
          </span>
          {message.local?.state === "failed" && (
            <span className={styles.bubbleMeta} role="alert">
              <span data-state="failed">Échec de l&apos;envoi ·</span>
              <button type="button" className={styles.retry} onClick={() => onRetry(message)}>
                Réessayer
              </button>
            </span>
          )}
        </div>
        {reactions.length > 0 && (
          <div className={styles.reactions}>
            {reactions.map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                className={styles.reactionChip}
                aria-pressed={message.my_reactions?.includes(emoji) ?? false}
                aria-label={`${emoji} ${count}${message.my_reactions?.includes(emoji) ? ", dont vous. Retirer" : ". Ajouter"}`}
                onClick={() => onReact(message, emoji)}
              >
                {emoji}
                {count > 1 && <span>{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {!local && (
        <div className={styles.tools} style={{ position: "relative" }}>
          {emojiOpen && (
            <div className={styles.emojiBar} role="group" aria-label="Réagir">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Réagir avec ${emoji}`}
                  aria-pressed={message.my_reactions?.includes(emoji) ?? false}
                  onClick={() => {
                    setEmojiOpen(false);
                    setToolsOpen(false);
                    onReact(message, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={styles.toolButton} aria-label="Réagir" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
            <SmileIcon />
          </button>
          <button type="button" className={styles.toolButton} aria-label="Répondre" onClick={() => onReply(message)}>
            <ReplyIcon />
          </button>
          <Menu label="Plus d'actions sur le message" items={menu} trigger={<MoreIcon />} triggerClassName={styles.toolButton} align={mine ? "right" : "left"} side="top" />
        </div>
      )}
    </div>
  );
}

export const MessageRow = memo(MessageRowImpl);
