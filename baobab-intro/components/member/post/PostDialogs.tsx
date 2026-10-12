"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { socialApi } from "@/features/social/api";
import { keys, useEditPost, useShare } from "@/features/social/hooks";
import type { Post, Visibility } from "@/features/social/types";
import { describeError } from "@/lib/api/errors";
import { VisibilityPicker } from "../composer/VisibilityPicker";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Post.module.css";

/** Libellés affichés pour les motifs connus (le serveur stocke ses libellés sans accents). */
const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harcèlement",
  hate: "Discours haineux",
  violence: "Violence",
  nudity: "Contenu sexuel",
  scam: "Arnaque ou fraude",
  copyright: "Violation de droits d'auteur",
  child_safety: "Sécurité des mineurs",
  misinformation: "Désinformation",
  other: "Autre",
};

/** Signaler une publication ou un commentaire (motifs fournis par le serveur). */
export function ReportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: { type: "post" | "comment"; id: string } }) {
  const toast = useToast();
  const reasons = useQuery({ queryKey: ["report-reasons"], queryFn: socialApi.reportReasons, staleTime: Infinity, enabled: open });
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      await socialApi.report(target.type, target.id, reason, details.trim());
      toast("Signalement envoyé. Merci : l'équipe de modération va l'examiner.", { tone: "success" });
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={sending}
      size="md"
      title={target.type === "post" ? "Signaler la publication" : "Signaler le commentaire"}
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost)} onClick={onClose} disabled={sending}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={submit} disabled={!reason || sending}>
            Envoyer le signalement
          </button>
        </>
      }
    >
      <div className={styles.formStack}>
        <fieldset className={styles.reasons}>
          <legend className={ui.label}>Pour quelle raison&nbsp;?</legend>
          {reasons.isPending && [0, 1, 2, 3].map((i) => <Skeleton key={i} height={46} radius={12} />)}
          {reasons.isError && <p className={ui.fieldError}>{describeError(reasons.error)}</p>}
          {reasons.data?.map((item) => (
            <label key={item.code} className={styles.reason}>
              <input type="radio" name="report-reason" value={item.code} checked={reason === item.code} onChange={() => setReason(item.code)} />
              {REASON_LABELS[item.code] ?? item.label}
            </label>
          ))}
        </fieldset>
        <div>
          <label className={ui.label} htmlFor="report-details">
            Précisions (facultatif)
          </label>
          <textarea id="report-details" className={ui.textarea} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        {error && (
          <p className={ui.fieldError} role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** Partager une publication sur son propre fil, avec un mot et une audience. */
export function ShareDialog({ open, onClose, post }: { open: boolean; onClose: () => void; post: Post }) {
  const toast = useToast();
  const share = useShare(post);
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={share.isPending}
      title="Partager sur mon fil"
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost)} onClick={onClose} disabled={share.isPending}>
            Annuler
          </button>
          <button
            type="button"
            className={cx(ui.button, ui.primary)}
            disabled={share.isPending}
            onClick={() =>
              share.mutate(
                { comment: comment.trim(), visibility },
                {
                  onSuccess: () => {
                    toast("Publication partagée.", { tone: "success" });
                    setComment("");
                    onClose();
                  },
                },
              )
            }
          >
            Partager
          </button>
        </>
      }
    >
      <div className={styles.formStack}>
        <div>
          <label className={ui.label} htmlFor={`share-${post.id}`}>
            Ajouter un mot (facultatif)
          </label>
          <textarea
            id={`share-${post.id}`}
            className={ui.textarea}
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Pourquoi partager la publication de ${post.author.display_name || post.author.username} ?`}
          />
        </div>
        <VisibilityPicker value={visibility} onChange={setVisibility} allowed={["public", "followers", "friends", "close_friends", "private"]} compact />
        {share.isError && (
          <p className={ui.fieldError} role="alert">
            {describeError(share.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Modifier le texte de sa publication.
 * Le fil ne contient qu'un extrait (500 caractères) : on recharge toujours la publication complète
 * avant d'éditer, sinon l'enregistrement tronquerait le texte.
 */
export function EditDialog({ open, onClose, post }: { open: boolean; onClose: () => void; post: Post }) {
  const full = useQuery({ queryKey: keys.post(post.id), queryFn: () => socialApi.post(post.id), enabled: open, staleTime: 0 });
  return (
    <Dialog open={open} onClose={onClose} title="Modifier la publication">
      {full.data ? (
        <EditForm key={full.data.edited_at ?? full.data.published_at} post={full.data} onDone={onClose} />
      ) : full.isError ? (
        <p className={ui.fieldError} role="alert">
          {describeError(full.error)}
        </p>
      ) : (
        <Skeleton height={180} radius={8} />
      )}
    </Dialog>
  );
}

function EditForm({ post, onDone }: { post: Post; onDone: () => void }) {
  const toast = useToast();
  const edit = useEditPost(post);
  const [body, setBody] = useState(post.body);
  return (
    <div className={styles.formStack}>
      <label className="bb-visually-hidden" htmlFor={`edit-${post.id}`}>
        Texte de la publication
      </label>
      <textarea id={`edit-${post.id}`} className={ui.textarea} style={{ minHeight: 180 }} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} />
      {edit.isError && (
        <p className={ui.fieldError} role="alert">
          {describeError(edit.error)}
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className={cx(ui.button, ui.ghost)} onClick={onDone} disabled={edit.isPending}>
          Annuler
        </button>
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          disabled={edit.isPending || body.trim() === post.body.trim()}
          onClick={() =>
            edit.mutate(body, {
              onSuccess: () => {
                toast("Publication modifiée.", { tone: "success" });
                onDone();
              },
            })
          }
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

/** Confirmation avant une action définitive. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirm: string;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      title={title}
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost)} onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, ui.danger)} onClick={onConfirm} disabled={busy}>
            {confirm}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--bb-ink-soft)" }}>{text}</p>
    </Dialog>
  );
}
