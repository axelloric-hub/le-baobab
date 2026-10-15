"use client";

import { useState, type FormEvent } from "react";
import { communityApi } from "@/features/community/api";
import { useModerate, useUpdateGroup } from "@/features/community/hooks";
import type { Group, GroupMember, JoinPolicy } from "@/features/community/types";
import type { UserBrief } from "@/features/social/types";
import { describeError, fieldError } from "@/lib/api/errors";
import { uploadFile } from "@/lib/uploads/upload";
import { AudiencePicker } from "../composer/AudiencePicker";
import { PhotoButton } from "../profile/EditProfileDialog";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { TrashIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Community.module.css";
import { JOIN_POLICY, MUTE_DURATIONS, PRIVACY } from "./labels";

/* ------------------------------------------------------------------ */
/* Modifier le groupe                                                  */
/* ------------------------------------------------------------------ */

export function EditGroupDialog({ group, open, onClose }: { group: Group; open: boolean; onClose: () => void }) {
  return open ? <EditGroup group={group} onClose={onClose} /> : null;
}

function EditGroup({ group, onClose }: { group: Group; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateGroup(group.slug);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [policy, setPolicy] = useState<JoinPolicy>(group.join_policy);
  const [photo, setPhoto] = useState<{ kind: "avatar" | "cover"; progress: number } | null>(null);
  const busy = update.isPending || photo !== null;

  // Photos : enregistrées dès l'envoi terminé (comme sur le profil), sans attendre « Enregistrer ».
  const uploadPhoto = async (kind: "avatar" | "cover", file: File) => {
    setPhoto({ kind, progress: 0 });
    try {
      const id = await uploadFile(file, kind, { onProgress: (progress) => setPhoto({ kind, progress }) });
      await update.mutateAsync(kind === "avatar" ? { avatar_file: id } : { cover_file: id });
      toast(kind === "avatar" ? "Photo du groupe mise à jour." : "Couverture mise à jour.", { tone: "success" });
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    } finally {
      setPhoto(null);
    }
  };
  const removePhoto = (kind: "avatar" | "cover") =>
    update.mutate(kind === "avatar" ? { avatar_file: null } : { cover_file: null }, { onError: (error) => toast(describeError(error), { tone: "error" }) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || name.trim().length < 3) return;
    update.mutate(
      { name: name.trim(), description: description.trim(), ...(group.privacy === "hidden" ? {} : { join_policy: policy }) },
      {
        onSuccess: () => {
          toast("Groupe mis à jour.", { tone: "success" });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title="Modifier le groupe"
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="submit" form="edit-group" className={cx(ui.button, ui.primary)} disabled={busy || name.trim().length < 3}>
            {update.isPending && !photo ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form id="edit-group" className={styles.form} onSubmit={submit} noValidate>
        <div>
          <span className={ui.label}>Couverture</span>
          <div className={styles.photoPreview}>
            {group.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée
              <img src={group.cover_url} alt="" />
            )}
          </div>
          <div className={styles.photoRow} style={{ marginTop: 8 }}>
            <PhotoButton label={photo?.kind === "cover" ? `Envoi… ${Math.round(photo.progress * 100)} %` : "Changer la couverture"} disabled={busy} onFile={(f) => uploadPhoto("cover", f)} />
            {group.cover_url && (
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => removePhoto("cover")} disabled={busy}>
                <TrashIcon />
                Retirer
              </button>
            )}
          </div>
        </div>
        <div>
          <span className={ui.label}>Photo du groupe</span>
          <div className={styles.photoRow}>
            <Avatar name={group.name} src={group.avatar_url} size={56} />
            <PhotoButton label={photo?.kind === "avatar" ? `Envoi… ${Math.round(photo.progress * 100)} %` : "Changer la photo"} disabled={busy} onFile={(f) => uploadPhoto("avatar", f)} />
            {group.avatar_url && (
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => removePhoto("avatar")} disabled={busy}>
                <TrashIcon />
                Retirer
              </button>
            )}
          </div>
        </div>
        <Field id="edit-group-name" label="Nom du groupe" error={fieldError(update.error, "name")}>
          <input id="edit-group-name" className={ui.input} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="edit-group-description" label="Description" optional error={fieldError(update.error, "description")}>
          <textarea id="edit-group-description" className={ui.textarea} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {group.privacy !== "hidden" && (
          <fieldset className={styles.choices}>
            <legend className={ui.label}>Qui peut entrer&nbsp;?</legend>
            {(Object.keys(JOIN_POLICY) as JoinPolicy[]).map((value) => (
              <label key={value} className={styles.choice}>
                <input type="radio" name="edit-group-policy" checked={policy === value} onChange={() => setPolicy(value)} />
                <span>
                  <strong>{JOIN_POLICY[value].label}</strong>
                  <small>{JOIN_POLICY[value].hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <p className={ui.hint}>
          Confidentialité&nbsp;: <strong>{PRIVACY[group.privacy].label}</strong>. Elle ne peut pas être modifiée, pour que les publications déjà faites ne deviennent jamais visibles d&apos;un public plus large.
        </p>
        {update.error && !fieldError(update.error, "name") && !fieldError(update.error, "description") && (
          <p className={ui.fieldError} role="alert">
            {describeError(update.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Inviter des membres                                                 */
/* ------------------------------------------------------------------ */

const INVITE_ERRORS: Record<string, string> = {
  already_member: "déjà membre",
  already_invited: "déjà invité(e)",
  banned: "banni(e) du groupe",
};

export function InviteDialog({ group, open, onClose }: { group: Group; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [people, setPeople] = useState<UserBrief[]>([]);
  const [sending, setSending] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  const send = async () => {
    setSending(true);
    setFailures([]);
    const failed: string[] = [];
    let sent = 0;
    // Une invitation par personne : l'échec de l'une n'empêche pas les autres.
    for (const person of people) {
      try {
        await communityApi.invite(group.slug, person.username);
        sent += 1;
      } catch (error) {
        const code = (error as { code?: string }).code ?? "";
        failed.push(`${person.display_name || person.username} : ${INVITE_ERRORS[code] ?? describeError(error)}`);
      }
    }
    setSending(false);
    if (sent > 0) toast(sent > 1 ? `${sent} invitations envoyées.` : "Invitation envoyée.", { tone: "success" });
    if (failed.length === 0) {
      setPeople([]);
      onClose();
    } else {
      setFailures(failed);
      setPeople((list) => list.filter((p) => failed.some((f) => f.startsWith(p.display_name || p.username))));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={sending}
      title={`Inviter dans « ${group.name} »`}
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={sending}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={send} disabled={sending || people.length === 0}>
            {sending ? "Envoi…" : people.length > 1 ? `Inviter ${people.length} personnes` : "Inviter"}
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <p className={ui.hint} style={{ marginTop: 0 }}>
          Les personnes invitées reçoivent une notification et peuvent accepter ou refuser depuis leur fil.
        </p>
        <AudiencePicker value={people} onChange={setPeople} />
        {failures.length > 0 && (
          <div role="alert">
            <p className={ui.fieldError}>Certaines invitations n&apos;ont pas été envoyées&nbsp;:</p>
            <ul className={ui.hint}>
              {failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Modération d'un membre                                              */
/* ------------------------------------------------------------------ */

export function ModerateDialog({ group, member, kind, onClose }: { group: Group; member: GroupMember; kind: "ban" | "mute"; onClose: () => void }) {
  const toast = useToast();
  const moderate = useModerate(group.slug);
  const [minutes, setMinutes] = useState(MUTE_DURATIONS[1].minutes);
  const [reason, setReason] = useState("");
  const name = member.display_name || member.username;

  const submit = () =>
    moderate.mutate(kind === "ban" ? { kind, username: member.username, reason: reason.trim() } : { kind, username: member.username, minutes, reason: reason.trim() }, {
      onSuccess: () => {
        toast(kind === "ban" ? `${name} a été banni(e) du groupe.` : `${name} est en sourdine.`, { tone: "success" });
        onClose();
      },
      onError: (error) => toast(describeError(error), { tone: "error" }),
    });

  return (
    <Dialog
      open
      onClose={onClose}
      busy={moderate.isPending}
      size="sm"
      title={kind === "ban" ? `Bannir ${name} ?` : `Mettre ${name} en sourdine`}
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost)} onClick={onClose} disabled={moderate.isPending}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, kind === "ban" ? ui.danger : ui.primary)} onClick={submit} disabled={moderate.isPending}>
            {kind === "ban" ? "Bannir" : "Mettre en sourdine"}
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--bb-ink-soft)" }}>
          {kind === "ban"
            ? "Ce membre est retiré du groupe et ne pourra plus le rejoindre ni voir son contenu privé."
            : "Ce membre reste dans le groupe mais ne peut plus y publier ni commenter pendant la durée choisie."}
        </p>
        {kind === "mute" && (
          <fieldset className={styles.choices}>
            <legend className={ui.label}>Durée</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MUTE_DURATIONS.map((d) => (
                <button key={d.minutes} type="button" className={ui.chip} aria-pressed={minutes === d.minutes} onClick={() => setMinutes(d.minutes)}>
                  {d.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <Field id="moderate-reason" label="Motif" optional hint="Gardé dans l'historique de modération du groupe.">
          <input id="moderate-reason" className={ui.input} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
