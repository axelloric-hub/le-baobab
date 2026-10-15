"use client";

import { useState, type FormEvent } from "react";
import { useSaveCompany } from "@/features/jobs/hooks";
import type { Company } from "@/features/jobs/types";
import { useReference } from "@/features/people/reference";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { uploadFile } from "@/lib/uploads/upload";
import { PhotoButton } from "../profile/EditProfileDialog";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field, slugify } from "../ui/Field";
import { TrashIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { COMPANY_SIZES } from "./labels";

/** Créer une entreprise (onCreated reçoit la nouvelle) ou modifier la sienne (company fourni). */
export function CompanyFormDialog({ open, onClose, company, onCreated }: { open: boolean; onClose: () => void; company?: Company; onCreated?: (c: Company) => void }) {
  return open ? <CompanyForm onClose={onClose} company={company} onCreated={onCreated} /> : null;
}

function CompanyForm({ onClose, company, onCreated }: { onClose: () => void; company?: Company; onCreated?: (c: Company) => void }) {
  const toast = useToast();
  const save = useSaveCompany(company?.slug);
  const countries = useReference("countries");
  const [values, setValues] = useState({
    name: company?.name ?? "",
    slug: "",
    tagline: company?.tagline ?? "",
    description: company?.description ?? "",
    website: company?.website ?? "",
    industry: company?.industry ?? "",
    size_range: company?.size_range ?? "",
    city: company?.city ?? "",
    country: company?.country ?? "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [photo, setPhoto] = useState<{ kind: "logo" | "cover"; progress: number } | null>(null);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const slug = slugEdited ? values.slug : slugify(values.name);
  const error = save.error;
  const slugError = error instanceof ApiError && error.code === "slug_taken" ? "Cette adresse est déjà prise : choisissez-en une autre." : fieldError(error, "slug");
  const websiteError = values.website && !/^https:\/\//.test(values.website) ? "L'adresse doit commencer par https://" : fieldError(error, "website");
  const ready = values.name.trim().length >= 2 && (company || /^[a-z0-9-]{2,80}$/.test(slug)) && !websiteError;
  const busy = save.isPending || photo !== null;

  const uploadPhoto = async (kind: "logo" | "cover", file: File) => {
    if (!company) return;
    setPhoto({ kind, progress: 0 });
    try {
      const id = await uploadFile(file, kind === "logo" ? "company_logo" : "company_cover", { onProgress: (progress) => setPhoto({ kind, progress }) });
      await save.mutateAsync(kind === "logo" ? { logo_file: id } : { cover_file: id });
      toast(kind === "logo" ? "Logo mis à jour." : "Couverture mise à jour.", { tone: "success" });
    } catch (err) {
      toast(describeError(err), { tone: "error" });
    } finally {
      setPhoto(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    const body = {
      name: values.name.trim(),
      tagline: values.tagline.trim(),
      description: values.description.trim(),
      website: values.website.trim(),
      industry: values.industry.trim(),
      size_range: values.size_range,
      city: values.city.trim(),
      ...(company ? { country: values.country || null } : { slug }),
    };
    save.mutate(body, {
      onSuccess: (saved) => {
        toast(company ? "Entreprise mise à jour." : `Entreprise « ${saved.name} » créée.`, { tone: "success" });
        onCreated?.(saved);
        onClose();
      },
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={company ? "Modifier l'entreprise" : "Créer une entreprise"}
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="submit" form="company-form" className={cx(ui.button, ui.primary)} disabled={!ready || busy}>
            {save.isPending && !photo ? "Enregistrement…" : company ? "Enregistrer" : "Créer l'entreprise"}
          </button>
        </>
      }
    >
      <form id="company-form" className={layout.form} onSubmit={submit} noValidate>
        {company && (
          <>
            <div>
              <span className={ui.label}>Couverture</span>
              <div className={layout.photoPreview}>
                {company.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- URL signée
                  <img src={company.cover_url} alt="" />
                )}
              </div>
              <div className={layout.photoRow} style={{ marginTop: 8 }}>
                <PhotoButton label={photo?.kind === "cover" ? `Envoi… ${Math.round(photo.progress * 100)} %` : "Changer la couverture"} disabled={busy} onFile={(f) => uploadPhoto("cover", f)} />
                {company.cover_url && (
                  <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => save.mutate({ cover_file: null })} disabled={busy}>
                    <TrashIcon />
                    Retirer
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className={ui.label}>Logo</span>
              <div className={layout.photoRow}>
                <Avatar name={company.name} src={company.logo_url} size={56} />
                <PhotoButton label={photo?.kind === "logo" ? `Envoi… ${Math.round(photo.progress * 100)} %` : "Changer le logo"} disabled={busy} onFile={(f) => uploadPhoto("logo", f)} />
                {company.logo_url && (
                  <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => save.mutate({ logo_file: null })} disabled={busy}>
                    <TrashIcon />
                    Retirer
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        <Field id="company-name" label="Nom de l'entreprise" error={fieldError(error, "name")}>
          <input id="company-name" data-autofocus className={ui.input} maxLength={140} value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" />
        </Field>
        {!company && (
          <Field id="company-slug" label="Adresse de la page" error={slugError} hint="Elle ne pourra plus changer.">
            <div className={layout.slugField}>
              <span className={layout.slugPrefix}>/entreprises/</span>
              <input
                id="company-slug"
                value={slug}
                maxLength={80}
                onChange={(e) => {
                  setSlugEdited(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                aria-invalid={Boolean(slugError) || undefined}
                spellCheck={false}
              />
            </div>
          </Field>
        )}
        <Field id="company-tagline" label="Accroche" optional hint="Une phrase : ce que fait l'entreprise.">
          <input id="company-tagline" className={ui.input} maxLength={200} value={values.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field id="company-description" label="Présentation" optional>
          <textarea id="company-description" className={ui.textarea} maxLength={10000} value={values.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className={layout.form} style={{ gap: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
          <Field id="company-industry" label="Secteur" optional>
            <input id="company-industry" className={ui.input} maxLength={80} value={values.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Fintech, e-santé…" />
          </Field>
          <Field id="company-size" label="Taille" optional>
            <select id="company-size" className={ui.select} value={values.size_range} onChange={(e) => set("size_range", e.target.value)}>
              <option value="">Non précisée</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} personnes
                </option>
              ))}
            </select>
          </Field>
          <Field id="company-city" label="Ville" optional>
            <input id="company-city" className={ui.input} maxLength={80} value={values.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
          </Field>
          {company && (
            <Field id="company-country" label="Pays" optional>
              <select id="company-country" className={ui.select} value={values.country} onChange={(e) => set("country", e.target.value)}>
                <option value="">Non précisé</option>
                {(countries.data ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field id="company-website" label="Site web" optional error={websiteError}>
          <input id="company-website" className={ui.input} type="url" inputMode="url" placeholder="https://" value={values.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        {error && !slugError && !fieldError(error, "name") && !websiteError && (
          <p className={ui.fieldError} role="alert">
            {describeError(error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
