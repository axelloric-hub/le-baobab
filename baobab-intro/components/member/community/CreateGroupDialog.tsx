"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCommunities, useCreateGroup } from "@/features/community/hooks";
import type { GroupPrivacy, JoinPolicy } from "@/features/community/types";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { ROUTES } from "@/lib/routes";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field, slugify } from "../ui/Field";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Community.module.css";
import { JOIN_POLICY, PRIVACY } from "./labels";

/** Créer un groupe : nom, adresse (déduite du nom, modifiable), description, confidentialité, adhésion, communauté. */
export function CreateGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CreateGroup onClose={onClose} /> : null;
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateGroup();
  const communities = useCommunities();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<GroupPrivacy>("public");
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>("open");
  const [community, setCommunity] = useState("");

  const effectiveSlug = slugEdited ? slug : slugify(name);
  // Un groupe secret est invisible : on n'y entre que sur invitation.
  const policy: JoinPolicy = privacy === "hidden" ? "invite_only" : joinPolicy;
  const error = create.error;
  const slugError = error instanceof ApiError && error.code === "slug_taken" ? "Cette adresse est déjà prise : choisissez-en une autre." : fieldError(error, "slug");
  const ready = name.trim().length >= 3 && /^[a-z0-9-]{3,80}$/.test(effectiveSlug);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || create.isPending) return;
    create.mutate(
      { name: name.trim(), slug: effectiveSlug, description: description.trim(), privacy, join_policy: policy, community: community || undefined },
      {
        onSuccess: (group) => {
          toast(`Groupe « ${group.name} » créé.`, { tone: "success" });
          onClose();
          router.push(ROUTES.group(group.slug));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      title="Créer un groupe"
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={create.isPending}>
            Annuler
          </button>
          <button type="submit" form="create-group" className={cx(ui.button, ui.primary)} disabled={!ready || create.isPending}>
            {create.isPending ? "Création…" : "Créer le groupe"}
          </button>
        </>
      }
    >
      <form id="create-group" className={styles.form} onSubmit={submit} noValidate>
        <Field id="group-name" label="Nom du groupe" error={fieldError(error, "name")} hint="Par exemple : Devs Django de Douala, React Abidjan…">
          <input
            id="group-name"
            data-autofocus
            className={ui.input}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            required
          />
        </Field>

        <Field id="group-slug" label="Adresse du groupe" error={slugError} hint="Lettres minuscules, chiffres et tirets. Elle ne pourra plus changer.">
          <div className={styles.slugField}>
            <span className={styles.slugPrefix}>/groupes/</span>
            <input
              id="group-slug"
              value={effectiveSlug}
              maxLength={80}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              aria-describedby={slugError ? "group-slug-error" : undefined}
              aria-invalid={Boolean(slugError) || undefined}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </Field>

        <Field id="group-description" label="Description" optional error={fieldError(error, "description")}>
          <textarea
            id="group-description"
            className={ui.textarea}
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="De quoi parle-t-on ici ? Pour qui est ce groupe ?"
          />
        </Field>

        <fieldset className={styles.choices}>
          <legend className={ui.label}>Confidentialité</legend>
          {(Object.keys(PRIVACY) as GroupPrivacy[]).map((value) => (
            <label key={value} className={styles.choice}>
              <input type="radio" name="group-privacy" value={value} checked={privacy === value} onChange={() => setPrivacy(value)} />
              <span>
                <strong>{PRIVACY[value].label}</strong>
                <small>{PRIVACY[value].hint}</small>
              </span>
            </label>
          ))}
          <p className={ui.hint}>La confidentialité ne peut plus être modifiée après la création.</p>
        </fieldset>

        {privacy !== "hidden" && (
          <fieldset className={styles.choices}>
            <legend className={ui.label}>Qui peut entrer&nbsp;?</legend>
            {(Object.keys(JOIN_POLICY) as JoinPolicy[]).map((value) => (
              <label key={value} className={styles.choice}>
                <input type="radio" name="group-policy" value={value} checked={joinPolicy === value} onChange={() => setJoinPolicy(value)} />
                <span>
                  <strong>{JOIN_POLICY[value].label}</strong>
                  <small>{JOIN_POLICY[value].hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {communities.data && communities.data.length > 0 && (
          <Field id="group-community" label="Communauté" optional hint="Rattachez le groupe à une communauté pour qu'on le trouve plus facilement.">
            <select id="group-community" className={ui.select} value={community} onChange={(e) => setCommunity(e.target.value)}>
              <option value="">Aucune</option>
              {communities.data.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && !slugError && !fieldError(error, "name") && (
          <p className={ui.fieldError} role="alert">
            {describeError(error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
