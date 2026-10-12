"use client";

import { useEffect, useRef, useState } from "react";
import { useMe } from "@/features/me/me";
import { useCreateStatus } from "@/features/social/hooks";
import { safeUrl } from "@/features/social/payload";
import type { UserBrief, Visibility } from "@/features/social/types";
import { describeError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { AudiencePicker } from "../composer/AudiencePicker";
import styles from "../composer/Composer.module.css";
import { ACCEPT, useUploads } from "../composer/use-uploads";
import { VisibilityPicker } from "../composer/VisibilityPicker";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { AudioIcon, CheckIcon, ImageIcon, LinkIcon, PlusIcon, TextIcon, TrashIcon, VideoIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { STATUS_BACKGROUNDS, readableOn } from "./status-utils";

type Format = "text" | "image" | "video" | "audio" | "link";

/** Formats proposés. « Document » n'est pas proposé : le serveur n'accepte pas les PDF pour un statut. */
const FORMATS: Array<{ value: Format; label: string; Icon: typeof TextIcon; accept?: string }> = [
  { value: "text", label: "Texte", Icon: TextIcon },
  { value: "image", label: "Image", Icon: ImageIcon, accept: ACCEPT.status_image },
  { value: "video", label: "Vidéo", Icon: VideoIcon, accept: ACCEPT.status_video },
  { value: "audio", label: "Audio", Icon: AudioIcon, accept: ACCEPT.status_audio },
  { value: "link", label: "Lien", Icon: LinkIcon },
];

const STATUS_VISIBILITIES: Visibility[] = ["public", "followers", "friends", "close_friends", "custom", "private"];
const BODY_MAX = 500;

export function StatusComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <StatusDialog onClose={onClose} /> : null;
}

function StatusDialog({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const create = useCreateStatus();
  const uploads = useUploads("status_media", 1);
  const [format, setFormat] = useState<Format>("text");
  const [body, setBody] = useState("");
  const [background, setBackground] = useState(STATUS_BACKGROUNDS[0].value);
  const [link, setLink] = useState("");
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [audience, setAudience] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const name = me.data?.display_name || me.data?.username || currentUser()?.username || "";
  const defaultVisibility = me.data?.privacy.default_status_visibility;
  const effectiveVisibility = visibility ?? (defaultVisibility && STATUS_VISIBILITIES.includes(defaultVisibility) ? defaultVisibility : "friends");
  const file = uploads.items[0];
  const needsFile = format === "image" || format === "video" || format === "audio";

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  const changeFormat = (next: Format) => {
    if (next === format) return;
    uploads.reset();
    setFormat(next);
    const option = FORMATS.find((f) => f.value === next);
    if (option?.accept) requestAnimationFrame(() => fileRef.current?.click());
  };

  const blocker = (() => {
    if (body.length > BODY_MAX) return "Le texte est trop long.";
    if (effectiveVisibility === "custom" && audience.length === 0) return "Choisissez au moins une personne.";
    if (format === "text") return body.trim() ? null : "Écrivez votre message.";
    if (format === "link") return safeUrl(link) ? null : "Saisissez une adresse web valide (https://…).";
    if (!file) return "Ajoutez un fichier.";
    if (file.error) return "Le fichier n'a pas pu être envoyé.";
    if (!file.fileId) return "Envoi du fichier en cours…";
    return null;
  })();

  const submit = () => {
    if (blocker || create.isPending) return;
    setError(null);
    create.mutate(
      {
        kind: format,
        body: body.trim(),
        visibility: effectiveVisibility,
        ...(needsFile && file?.fileId ? { file: file.fileId } : {}),
        ...(format === "link" ? { link_url: safeUrl(link)! } : {}),
        ...(format === "text" || format === "link" ? { style: { background } } : {}),
        ...(effectiveVisibility === "custom" ? { audience: audience.map((u) => u.username) } : {}),
      },
      {
        onSuccess: () => {
          uploads.reset();
          onClose();
          toast("Statut publié pour 24 heures.", { tone: "success" });
        },
        onError: (err) => setError(describeError(err)),
      },
    );
  };

  const option = FORMATS.find((f) => f.value === format)!;
  const fg = readableOn(background);

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      size="lg"
      title="Créer un statut"
      footer={
        <>
          <span className={styles.footerNote}>{blocker && (body || file || link) ? blocker : "Visible pendant 24 heures"}</span>
          <button type="button" className={cx(ui.button, ui.ghost)} onClick={onClose} disabled={create.isPending}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={submit} disabled={Boolean(blocker) || create.isPending}>
            {create.isPending ? "Publication…" : "Publier le statut"}
          </button>
        </>
      }
    >
      <div className={styles.statusLayout}>
        <div className={styles.stack}>
          <div role="radiogroup" aria-label="Format du statut" className={styles.formats}>
            {FORMATS.map(({ value, label, Icon }) => (
              <button key={value} type="button" role="radio" aria-checked={format === value} className={ui.chip} onClick={() => changeFormat(value)}>
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {needsFile && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={option.accept}
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) {
                    uploads.reset();
                    void uploads.add(e.target.files);
                  }
                  e.target.value = "";
                }}
              />
              {file ? (
                <ul className={styles.files} style={{ marginTop: 0, gridTemplateColumns: "minmax(0, 220px)" }}>
                  <li className={styles.fileItem}>
                    <div className={styles.thumb}>
                      {file.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
                        <img src={file.preview} alt="" />
                      ) : file.kind === "video" ? (
                        <video src={file.preview} muted playsInline preload="metadata" />
                      ) : (
                        <AudioIcon aria-hidden="true" />
                      )}
                      <span className={styles.fileState} data-tone={file.error ? "error" : file.fileId ? "done" : undefined}>
                        {file.error ? "Erreur" : file.fileId ? "Prêt" : `${Math.round(file.progress * 100)} %`}
                      </span>
                      {!file.fileId && !file.error && (
                        <span className={styles.fileProgress} role="progressbar" aria-valuenow={Math.round(file.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Envoi du fichier">
                          <span style={{ width: `${file.progress * 100}%` }} />
                        </span>
                      )}
                      <button type="button" className={styles.fileRemove} onClick={() => uploads.remove(file.key)} aria-label="Retirer le fichier">
                        <TrashIcon />
                      </button>
                    </div>
                    {file.error && <p className={styles.fileError}>{file.error}</p>}
                  </li>
                </ul>
              ) : (
                <button type="button" className={styles.drop} onClick={() => fileRef.current?.click()}>
                  <PlusIcon aria-hidden="true" />
                  <strong>Choisir {format === "image" ? "une image" : format === "video" ? "une vidéo" : "un audio"}</strong>
                  <small>
                    {format === "image" ? "JPEG, PNG, WebP ou GIF" : format === "video" ? "MP4 ou WebM" : "MP3, OGG ou WAV"} · 50&nbsp;Mo maximum
                  </small>
                </button>
              )}
            </div>
          )}

          {format === "link" && (
            <div>
              <label className={ui.label} htmlFor="status-link">
                Adresse du lien
              </label>
              <input id="status-link" className={ui.input} type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
          )}

          <div>
            <label className={ui.label} htmlFor="status-body">
              {format === "text" ? "Votre message" : "Légende (facultatif)"}
            </label>
            <textarea id="status-body" ref={bodyRef} className={ui.textarea} maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className={styles.counter}>
              {body.length} / {BODY_MAX}
            </p>
          </div>

          {(format === "text" || format === "link") && (
            <div>
              <p className={ui.label} id="status-bg">
                Couleur de fond
              </p>
              <div className={styles.swatches} role="radiogroup" aria-labelledby="status-bg">
                {STATUS_BACKGROUNDS.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    role="radio"
                    aria-checked={background === swatch.value}
                    aria-label={swatch.label}
                    className={styles.swatch}
                    style={{ background: swatch.value, color: readableOn(swatch.value) }}
                    onClick={() => setBackground(swatch.value)}
                  >
                    {background === swatch.value && <CheckIcon />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <VisibilityPicker value={effectiveVisibility} onChange={setVisibility} allowed={STATUS_VISIBILITIES} legend="Qui peut voir ce statut ?" compact />
          {effectiveVisibility === "custom" && <AudiencePicker value={audience} onChange={setAudience} />}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>

        <div>
          <p className={styles.previewLabel}>Aperçu</p>
          <div
            className={styles.preview}
            style={{ background: format === "text" || format === "link" ? background : "#120905", color: format === "text" || format === "link" ? fg : "#fff" }}
            aria-label="Aperçu du statut"
            role="img"
          >
            {file && file.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
              <img className={styles.previewMedia} src={file.preview} alt="" />
            )}
            {file && file.kind === "video" && <video className={styles.previewMedia} src={file.preview} muted autoPlay loop playsInline />}
            <div className={styles.previewHead}>
              <Avatar name={name || "?"} src={me.data?.avatar_url} size={24} />
              {name}
              <small>À l&apos;instant</small>
            </div>
            <div className={styles.previewBody}>
              {format === "text" ? (
                body.trim() ? body : <span className={styles.previewEmpty}>Votre message apparaîtra ici</span>
              ) : format === "link" ? (
                <span>
                  {body.trim() || ""}
                  {safeUrl(link) && <span style={{ display: "block", marginTop: 10, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{new URL(safeUrl(link)!).hostname}</span>}
                  {!body.trim() && !safeUrl(link) && <span className={styles.previewEmpty}>Votre lien apparaîtra ici</span>}
                </span>
              ) : format === "audio" && file ? (
                <AudioIcon width={48} height={48} aria-hidden="true" />
              ) : !file ? (
                <span className={styles.previewEmpty}>Votre {format === "image" ? "image" : format === "video" ? "vidéo" : "audio"} apparaîtra ici</span>
              ) : null}
            </div>
            {needsFile && body.trim() && <p className={styles.previewCaption}>{body}</p>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
