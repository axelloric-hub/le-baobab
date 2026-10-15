"use client";

import { useRef, useState } from "react";
import { useUpdateMe } from "@/features/people/mutations";
import { PROVIDER_LABELS, SKILL_LEVELS, useReference } from "@/features/people/reference";
import type { Availability, Profile } from "@/features/people/types";
import { describeError, fieldError } from "@/lib/api/errors";
import { uploadFile } from "@/lib/uploads/upload";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { CameraIcon, PlusIcon, TrashIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { SkillPicker } from "./PortfolioDialogs";
import styles from "./Profile.module.css";

type Section = "identite" | "competences" | "liens";

const AVAILABILITIES: Array<{ value: Availability; label: string }> = [
  { value: "none", label: "Ne pas afficher" },
  { value: "open_to_work", label: "Ouvert aux opportunités" },
  { value: "freelance", label: "Disponible pour des missions" },
  { value: "hiring", label: "Je recrute" },
];

/** Bouton accessible au clavier qui ouvre le sélecteur de fichier. */
export function PhotoButton({ label, disabled, onFile }: { label: string; disabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={cx(ui.button, ui.secondary, ui.small)} disabled={disabled} onClick={() => input.current?.click()}>
        <CameraIcon />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

export function EditProfileDialog({ open, onClose, profile, initialSection = "identite" }: { open: boolean; onClose: () => void; profile: Profile; initialSection?: Section }) {
  return open ? <EditProfile onClose={onClose} profile={profile} initialSection={initialSection} /> : null;
}

function EditProfile({ onClose, profile, initialSection }: { onClose: () => void; profile: Profile; initialSection: Section }) {
  const toast = useToast();
  const update = useUpdateMe(profile.username);
  const countries = useReference("countries");
  const professions = useReference("professions");
  const [section, setSection] = useState<Section>(initialSection);
  const [form, setForm] = useState({
    display_name: profile.display_name,
    headline: profile.headline,
    bio: profile.bio,
    country: profile.country?.code ?? "",
    region: profile.region,
    city: profile.city,
    profession: profile.profession?.slug ?? "",
    availability: profile.availability,
  });
  const [skills, setSkills] = useState(profile.skills.map((s) => ({ slug: s.slug, name: s.name, level: s.level })));
  const [link, setLink] = useState({ provider: "github", url: "" });
  const [photo, setPhoto] = useState<{ kind: "avatar" | "cover"; progress: number } | null>(null);
  const [preview, setPreview] = useState<{ avatar?: string; cover?: string }>({});
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveIdentity = () => {
    const changed: Record<string, unknown> = {};
    const original = {
      display_name: profile.display_name,
      headline: profile.headline,
      bio: profile.bio,
      country: profile.country?.code ?? "",
      region: profile.region,
      city: profile.city,
      profession: profile.profession?.slug ?? "",
      availability: profile.availability,
    };
    for (const [key, value] of Object.entries(form)) {
      if (value !== original[key as keyof typeof original]) changed[key] = (key === "country" || key === "profession") && !value ? null : typeof value === "string" ? value.trim() : value;
    }
    if (Object.keys(changed).length === 0) return onClose();
    update.profile.mutate(changed, {
      onSuccess: () => {
        toast("Profil enregistré.", { tone: "success" });
        onClose();
      },
    });
  };

  const saveSkills = () =>
    update.skills.mutate(
      skills.map((s) => ({ slug: s.slug, level: s.level })),
      {
        onSuccess: () => {
          toast("Compétences enregistrées.", { tone: "success" });
          onClose();
        },
      },
    );

  const uploadPhoto = async (kind: "avatar" | "cover", file: File) => {
    setPreview((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    setPhoto({ kind, progress: 0 });
    try {
      const id = await uploadFile(file, kind, { onProgress: (progress) => setPhoto({ kind, progress }) });
      await update.profile.mutateAsync({ [`${kind}_file`]: id });
      toast(kind === "avatar" ? "Photo de profil mise à jour." : "Photo de couverture mise à jour.", { tone: "success" });
    } catch (error) {
      setPreview((p) => ({ ...p, [kind]: undefined }));
      toast(describeError(error), { tone: "error" });
    } finally {
      setPhoto(null);
    }
  };

  const removePhoto = (kind: "avatar" | "cover") =>
    update.profile.mutate({ [`${kind}_file`]: null }, { onSuccess: () => setPreview((p) => ({ ...p, [kind]: undefined })) });

  const busy = update.profile.isPending || update.skills.isPending || Boolean(photo);
  const err = (field: string) => fieldError(update.profile.error, field);

  const footer =
    section === "liens" ? (
      <button type="button" className={cx(ui.button, ui.primary)} onClick={onClose}>
        Terminé
      </button>
    ) : (
      <>
        <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={section === "identite" ? saveIdentity : saveSkills} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </>
    );

  return (
    <Dialog open onClose={onClose} busy={busy} size="lg" title="Modifier le profil" footer={footer}>
      <div className={styles.dialogTabs} role="tablist" aria-label="Sections du profil">
        {(
          [
            ["identite", "Identité et photos"],
            ["competences", "Compétences"],
            ["liens", "Liens"],
          ] as Array<[Section, string]>
        ).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={section === value} className={ui.chip} data-active={section === value || undefined} onClick={() => setSection(value)}>
            {label}
          </button>
        ))}
      </div>

      {section === "identite" && (
        <div className={styles.form}>
          <div>
            <span className={ui.label}>Photo de couverture</span>
            <div className={styles.coverPreview}>
              {(preview.cover || profile.cover_url) && (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL signée
                <img src={preview.cover || profile.cover_url!} alt="" />
              )}
            </div>
            <div className={styles.photoRow} style={{ marginTop: 8 }}>
              <PhotoButton label={photo?.kind === "cover" ? `Envoi… ${Math.round(photo.progress * 100)} %` : "Changer la couverture"} disabled={busy} onFile={(f) => uploadPhoto("cover", f)} />
              {(profile.cover_url || preview.cover) && (
                <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => removePhoto("cover")} disabled={busy}>
                  Retirer
                </button>
              )}
            </div>
          </div>
          <div className={styles.photoRow}>
            <Avatar name={form.display_name || profile.username} src={preview.avatar || profile.avatar_url} size={64} />
            <PhotoButton label={photo?.kind === "avatar" ? `Envoi… ${Math.round(photo.progress * 100)} %` : "Changer la photo"} disabled={busy} onFile={(f) => uploadPhoto("avatar", f)} />
            {(profile.avatar_url || preview.avatar) && (
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => removePhoto("avatar")} disabled={busy}>
                Retirer
              </button>
            )}
          </div>
          <div className={styles.row2}>
            <div>
              <label className={ui.label} htmlFor="ep-name">
                Nom affiché
              </label>
              <input id="ep-name" className={ui.input} maxLength={80} value={form.display_name} onChange={set("display_name")} />
              {err("display_name") && <p className={ui.fieldError}>{err("display_name")}</p>}
            </div>
            <div>
              <label className={ui.label} htmlFor="ep-availability">
                Disponibilité
              </label>
              <select id="ep-availability" className={ui.select} value={form.availability} onChange={set("availability")}>
                {AVAILABILITIES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={ui.label} htmlFor="ep-headline">
              Titre
            </label>
            <input id="ep-headline" className={ui.input} maxLength={160} placeholder="ex. : Développeuse backend Python · Paiements mobiles" value={form.headline} onChange={set("headline")} />
            <p className={ui.hint}>Une ligne qui dit ce que vous faites. {form.headline.length} / 160</p>
          </div>
          <div>
            <label className={ui.label} htmlFor="ep-bio">
              Présentation
            </label>
            <textarea id="ep-bio" className={ui.textarea} style={{ minHeight: 120 }} maxLength={2000} value={form.bio} onChange={set("bio")} />
            <p className={ui.hint}>{form.bio.length} / 2000</p>
          </div>
          <div className={styles.row2}>
            <div>
              <label className={ui.label} htmlFor="ep-profession">
                Métier
              </label>
              <select id="ep-profession" className={ui.select} value={form.profession} onChange={set("profession")}>
                <option value="">Non précisé</option>
                {professions.data?.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={ui.label} htmlFor="ep-country">
                Pays
              </label>
              <select id="ep-country" className={ui.select} value={form.country} onChange={set("country")}>
                <option value="">Non précisé</option>
                {countries.data?.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.row2}>
            <div>
              <label className={ui.label} htmlFor="ep-region">
                Région (facultatif)
              </label>
              <input id="ep-region" className={ui.input} maxLength={80} value={form.region} onChange={set("region")} />
            </div>
            <div>
              <label className={ui.label} htmlFor="ep-city">
                Ville (facultatif)
              </label>
              <input id="ep-city" className={ui.input} maxLength={80} value={form.city} onChange={set("city")} />
            </div>
          </div>
          {update.profile.isError && !err("display_name") && (
            <p className={ui.fieldError} role="alert">
              {describeError(update.profile.error)}
            </p>
          )}
        </div>
      )}

      {section === "competences" && (
        <div className={styles.form}>
          <div>
            <span className={ui.label}>Ajouter une compétence</span>
            <SkillPicker value={[]} onChange={(added) => setSkills((list) => [...list, ...added.filter((a) => !list.some((s) => s.slug === a.slug)).map((a) => ({ ...a, level: 3 }))])} max={60} />
          </div>
          {skills.length === 0 ? (
            <p className={styles.empty}>Aucune compétence pour l&apos;instant.</p>
          ) : (
            <ul className={styles.skillEdit} aria-label="Mes compétences">
              {skills.map((s) => (
                <li key={s.slug}>
                  <span>{s.name}</span>
                  <label className="bb-visually-hidden" htmlFor={`lvl-${s.slug}`}>
                    Niveau en {s.name}
                  </label>
                  <select id={`lvl-${s.slug}`} value={s.level} onChange={(e) => setSkills((list) => list.map((x) => (x.slug === s.slug ? { ...x, level: Number(e.target.value) } : x)))}>
                    {SKILL_LEVELS.map((label, i) => (
                      <option key={label} value={i + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={ui.iconButton} aria-label={`Retirer ${s.name}`} onClick={() => setSkills((list) => list.filter((x) => x.slug !== s.slug))} style={{ width: 36, height: 36 }}>
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {update.skills.isError && (
            <p className={ui.fieldError} role="alert">
              {describeError(update.skills.error)}
            </p>
          )}
        </div>
      )}

      {section === "liens" && (
        <div className={styles.form}>
          {profile.links.length > 0 && (
            <ul className={styles.skillEdit} aria-label="Mes liens">
              {profile.links.map((l) => (
                <li key={l.id}>
                  <span>
                    {PROVIDER_LABELS[l.provider] ?? l.provider}
                    <small style={{ display: "block", fontWeight: 500, color: "var(--bb-ink-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{l.url}</small>
                  </span>
                  <button
                    type="button"
                    className={ui.iconButton}
                    aria-label={`Supprimer le lien ${PROVIDER_LABELS[l.provider] ?? l.provider}`}
                    onClick={() => update.removeLink.mutate(l.id, { onError: (e) => toast(describeError(e), { tone: "error" }) })}
                    style={{ width: 36, height: 36 }}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              update.addLink.mutate(link, {
                onSuccess: () => {
                  setLink({ provider: link.provider, url: "" });
                  toast("Lien ajouté.", { tone: "success" });
                },
              });
            }}
          >
            <div className={styles.row2}>
              <div>
                <label className={ui.label} htmlFor="ep-provider">
                  Type de lien
                </label>
                <select id="ep-provider" className={ui.select} value={link.provider} onChange={(e) => setLink((l) => ({ ...l, provider: e.target.value }))}>
                  {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ui.label} htmlFor="ep-url">
                  Adresse (https://…)
                </label>
                <input id="ep-url" className={ui.input} type="url" inputMode="url" placeholder="https://" value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} />
              </div>
            </div>
            {update.addLink.isError && (
              <p className={ui.fieldError} role="alert">
                {fieldError(update.addLink.error, "url") ?? describeError(update.addLink.error)}
              </p>
            )}
            <button type="submit" className={cx(ui.button, ui.secondary)} style={{ alignSelf: "flex-start" }} disabled={!link.url.startsWith("https://") || update.addLink.isPending}>
              <PlusIcon />
              Ajouter le lien
            </button>
          </form>
        </div>
      )}
    </Dialog>
  );
}
