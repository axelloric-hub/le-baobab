"use client";

import { useEffect, useRef, useState } from "react";
import type { Message, MessageKind, SendInput } from "@/features/messaging/types";
import { ACCEPT, useUploads } from "../composer/use-uploads";
import { CloseIcon, CodeIcon, FileIcon, PaperclipIcon, SendIcon } from "../ui/icons";
import { kindLabel } from "./labels";
import styles from "./Messages.module.css";

const LANGUAGES = ["python", "javascript", "typescript", "java", "kotlin", "go", "rust", "php", "c", "cpp", "csharp", "dart", "sql", "bash", "html", "css", "json", "yaml"];
const ATTACH_ACCEPT = `${ACCEPT.post_media},application/zip`;

interface ComposerProps {
  conversationId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: (input: Omit<SendInput, "client_msg_id">) => void;
  onTyping: () => void;
  placeholder: string;
  /** Message en cours de modification (remplace l'envoi par l'enregistrement). */
  editing: Message | null;
  onCancelEdit: () => void;
  onSaveEdit: (body: string) => void;
}

const DRAFT_PREFIX = "baobab.draft.message.";

function kindFor(files: Array<{ kind: string }>): MessageKind {
  const kinds = new Set(files.map((f) => f.kind));
  if (kinds.size === 1 && kinds.has("image")) return "image";
  if (kinds.size === 1 && kinds.has("video")) return "video";
  if (kinds.size === 1 && kinds.has("audio")) return "audio";
  return "file";
}

/** Saisie : texte qui grandit, pièces jointes (envoi direct au stockage), mode code, réponse citée, brouillon par conversation. */
export function MessageComposer({ conversationId, replyTo, onCancelReply, onSend, onTyping, placeholder, editing, onCancelEdit, onSaveEdit }: ComposerProps) {
  const [body, setBody] = useState(() => {
    try {
      return window.localStorage.getItem(DRAFT_PREFIX + conversationId) ?? "";
    } catch {
      return "";
    }
  });
  const [code, setCode] = useState(false);
  const [language, setLanguage] = useState("python");
  const uploads = useUploads("message_attachment", 10);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);

  // Brouillon conservé par conversation.
  useEffect(() => {
    if (editing) return;
    const timer = window.setTimeout(() => {
      try {
        if (body) window.localStorage.setItem(DRAFT_PREFIX + conversationId, body);
        else window.localStorage.removeItem(DRAFT_PREFIX + conversationId);
      } catch {
        /* stockage indisponible */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [body, conversationId, editing]);

  // Modification : le texte du message remplit le champ.
  useEffect(() => {
    if (editing) {
      setBody(editing.body);
      setCode(false);
      textRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) textRef.current?.focus();
  }, [replyTo]);

  // Hauteur automatique (jusqu'à 160 px, puis défilement).
  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(160, node.scrollHeight)}px`;
  }, [body]);

  const ready = uploads.items.filter((i) => i.fileId);
  const canSend = !uploads.busy && (body.trim().length > 0 || ready.length > 0);

  const submit = () => {
    if (editing) {
      if (body.trim() && body.trim() !== editing.body) onSaveEdit(body.trim());
      else onCancelEdit();
      setBody("");
      return;
    }
    if (!canSend) return;
    const text = code ? body.replace(/\s+$/, "") : body.trim();
    const input: Omit<SendInput, "client_msg_id"> = { body: text };
    if (replyTo) input.reply_to = replyTo.id;
    if (ready.length > 0) {
      input.attachments = ready.map((i) => i.fileId!);
      input.kind = kindFor(ready);
      if (text) input.metadata = {};
    } else if (code) {
      input.kind = "code";
      input.metadata = { language };
    }
    onSend(input);
    setBody("");
    setCode(false);
    uploads.reset();
    textRef.current?.focus();
  };

  return (
    <div className={styles.composer}>
      {(replyTo || editing) && (
        <div className={styles.replyBar}>
          <div>
            <strong>{editing ? "Modifier le message" : `Répondre à ${replyTo!.sender?.display_name || replyTo!.sender?.username || "ce message"}`}</strong>
            <span>{(editing ?? replyTo)!.body || kindLabel((editing ?? replyTo)!.kind, (editing ?? replyTo)!.attachments.length)}</span>
          </div>
          <button
            type="button"
            className={styles.fieldButton}
            aria-label={editing ? "Annuler la modification" : "Annuler la réponse"}
            onClick={() => {
              if (editing) {
                setBody("");
                onCancelEdit();
              } else onCancelReply();
            }}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {uploads.items.length > 0 && (
        <div className={styles.pending} aria-label="Pièces jointes">
          {uploads.items.map((item) => (
            <div key={item.key} className={styles.pendingItem}>
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
                <img src={item.preview} alt="" />
              ) : (
                <FileIcon width={24} height={24} aria-hidden="true" />
              )}
              <span>
                {item.file.name}
                <small data-error={item.error ? "" : undefined}>{item.error ? item.error : item.fileId ? "Prêt" : `${Math.round(item.progress * 100)} %`}</small>
              </span>
              <button type="button" onClick={() => uploads.remove(item.key)} aria-label={`Retirer ${item.file.name}`}>
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {code && !editing && (
        <label className={styles.codeLang}>
          Langage
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}

      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={styles.field} data-code={code || undefined}>
          {!editing && (
            <button type="button" className={styles.fieldButton} aria-label="Joindre des fichiers" onClick={() => fileRef.current?.click()} disabled={uploads.items.length >= 10}>
              <PaperclipIcon />
            </button>
          )}
          <label htmlFor={`composer-${conversationId}`} className="bb-visually-hidden">
            Votre message
          </label>
          <textarea
            id={`composer-${conversationId}`}
            ref={textRef}
            rows={1}
            maxLength={10000}
            value={body}
            spellCheck={!code}
            placeholder={code ? "Collez votre code…" : placeholder}
            onChange={(e) => {
              setBody(e.target.value);
              const now = Date.now();
              if (now - lastTyping.current > 3000) {
                lastTyping.current = now;
                onTyping();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && editing) {
                setBody("");
                onCancelEdit();
              }
              // Ordinateur : Entrée envoie, Maj + Entrée passe à la ligne (en mode code : Ctrl + Entrée).
              if (e.key === "Enter" && window.matchMedia("(pointer: fine)").matches) {
                if (code ? e.ctrlKey || e.metaKey : !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }
            }}
          />
          {!editing && (
            <button type="button" className={styles.fieldButton} aria-label="Envoyer du code" aria-pressed={code} onClick={() => setCode((v) => !v)} disabled={ready.length > 0}>
              <CodeIcon />
            </button>
          )}
        </div>
        <button type="submit" className={styles.send} disabled={editing ? !body.trim() : !canSend} aria-label={editing ? "Enregistrer la modification" : "Envoyer"}>
          <SendIcon />
        </button>
      </form>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept={ATTACH_ACCEPT}
        onChange={(e) => {
          if (e.target.files?.length) void uploads.add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
