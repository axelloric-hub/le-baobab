"use client";

import { useState, type FormEvent } from "react";
import { useProjectMutations, usePortfolioSettings } from "@/features/showcase/hooks";
import type { ShowcaseProject } from "@/features/showcase/types";
import type { Portfolio } from "@/features/people/types";
import { describeError, fieldError } from "@/lib/api/errors";
import { SkillPicker } from "../profile/PortfolioDialogs";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { VISIBILITIES } from "../ui/visibility";

/** « 2024-03-01 » ↔ « 2024-03 » (champ mois). */
const toMonth = (date: string | null) => (date ? date.slice(0, 7) : "");
const toDate = (month: string) => (month ? `${month}-01` : null);

/** Les visibilités possibles pour un portfolio (ni groupe ni audience personnalisée, contrainte du serveur). */
export const PORTFOLIO_VISIBILITIES = VISIBILITIES.filter((v) => v.value !== "group_members" && v.value !== "custom");

function Footer({ busy, ready, label, onCancel, onSubmit }: { busy: boolean; ready: boolean; label: string; onCancel: () => void; onSubmit: () => void }) {
  return (
    <>
      <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onCancel} disabled={busy}>
        Annuler
      </button>
      <button type="button" className={cx(ui.button, ui.primary)} onClick={onSubmit} disabled={!ready || busy}>
        {busy ? "Enregistrement…" : label}
      </button>
    </>
  );
}

export function EditProjectDialog({ project, open, onClose }: { project: ShowcaseProject; open: boolean; onClose: () => void }) {
  return open ? <EditProjectForm project={project} onClose={onClose} /> : null;
}

function EditProjectForm({ project, onClose }: { project: ShowcaseProject; onClose: () => void }) {
  const toast = useToast();
  const { update } = useProjectMutations(project.id);
  const [title, setTitle] = useState(project.title);
  const [role, setRole] = useState(project.role);
  const [description, setDescription] = useState(project.description);
  const [techs, setTechs] = useState(project.technologies);
  const [start, setStart] = useState(toMonth(project.started_on));
  const [end, setEnd] = useState(toMonth(project.ended_on));
  const [featured, setFeatured] = useState(project.is_featured);
  const err = (f: string) => fieldError(update.error, f);
  const datesOk = !start || !end || end >= start;
  const ready = Boolean(title.trim()) && datesOk;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!ready) return;
    update.mutate(
      { title: title.trim(), role: role.trim(), description: description.trim(), technologies: techs.map((t) => t.slug), started_on: toDate(start), ended_on: toDate(end), is_featured: featured },
      {
        onSuccess: () => {
          toast("Projet mis à jour.", { tone: "success" });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onClose={onClose} busy={update.isPending} title="Modifier le projet" footer={<Footer busy={update.isPending} ready={ready} label="Enregistrer" onCancel={onClose} onSubmit={submit} />}>
      <form className={layout.form} onSubmit={submit}>
        <Field id="pe-title" label="Nom du projet" error={err("title")}>
          <input id="pe-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="pe-role" label="Votre rôle" optional error={err("role")}>
          <input id="pe-role" className={ui.input} maxLength={100} placeholder="ex. : Développeuse backend principale" value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>
        <Field id="pe-description" label="Description" optional error={err("description")} hint="Le problème résolu, vos choix techniques, le résultat.">
          <textarea id="pe-description" className={ui.textarea} style={{ minHeight: 160 }} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div>
          <span className={ui.label}>Technologies</span>
          <SkillPicker value={techs} onChange={setTechs} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Field id="pe-start" label="Début" optional error={err("started_on")}>
            <input id="pe-start" className={ui.input} type="month" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field id="pe-end" label="Fin" optional error={err("ended_on") ?? (datesOk ? undefined : "La fin précède le début.")}>
            <input id="pe-end" className={ui.input} type="month" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Épingler ce projet en tête de mon portfolio
        </label>
        {update.isError && !Object.keys((update.error as { fields?: object })?.fields ?? {}).length && (
          <p className={ui.fieldError} role="alert">
            {describeError(update.error)}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

const LINK_KINDS = [
  { value: "demo", label: "Démo ou site" },
  { value: "repository", label: "Dépôt de code" },
  { value: "article", label: "Article" },
  { value: "other", label: "Autre" },
];

export function AddLinkDialog({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { addLink } = useProjectMutations(projectId);
  const [kind, setKind] = useState("demo");
  const [url, setUrl] = useState("");
  const ready = /^https:\/\/\S+\.\S+/.test(url.trim());
  const close = () => {
    setUrl("");
    addLink.reset();
    onClose();
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!ready) return;
    addLink.mutate(
      { kind, url: url.trim() },
      {
        onSuccess: () => {
          toast("Lien ajouté.", { tone: "success" });
          close();
        },
      },
    );
  };
  return (
    <Dialog open={open} onClose={close} size="sm" busy={addLink.isPending} title="Ajouter un lien" footer={<Footer busy={addLink.isPending} ready={ready} label="Ajouter" onCancel={close} onSubmit={submit} />}>
      <form className={layout.form} onSubmit={submit}>
        <Field id="pl-kind" label="Type de lien">
          <select id="pl-kind" className={ui.select} value={kind} onChange={(e) => setKind(e.target.value)}>
            {LINK_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pl-url" label="Adresse" error={fieldError(addLink.error, "url") ?? (addLink.isError ? describeError(addLink.error) : undefined)} hint="Adresse sécurisée (https://).">
          <input id="pl-url" data-autofocus className={ui.input} type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function PortfolioSettingsDialog({ portfolio, open, onClose }: { portfolio: Portfolio; open: boolean; onClose: () => void }) {
  return open ? <PortfolioSettingsForm portfolio={portfolio} onClose={onClose} /> : null;
}

function PortfolioSettingsForm({ portfolio, onClose }: { portfolio: Portfolio; onClose: () => void }) {
  const toast = useToast();
  const save = usePortfolioSettings(portfolio.owner.username);
  const [title, setTitle] = useState(portfolio.title);
  const [summary, setSummary] = useState(portfolio.summary);
  const [visibility, setVisibility] = useState(portfolio.visibility);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    save.mutate(
      { title: title.trim(), summary: summary.trim(), visibility },
      {
        onSuccess: () => {
          toast("Portfolio mis à jour.", { tone: "success" });
          onClose();
        },
      },
    );
  };
  return (
    <Dialog open onClose={onClose} busy={save.isPending} title="Mon portfolio" footer={<Footer busy={save.isPending} ready label="Enregistrer" onCancel={onClose} onSubmit={submit} />}>
      <form className={layout.form} onSubmit={submit}>
        <Field id="pp-title" label="Titre" optional error={fieldError(save.error, "title")}>
          <input id="pp-title" data-autofocus className={ui.input} maxLength={140} placeholder="ex. : Développeuse full-stack, Python et React" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="pp-summary" label="Présentation" optional error={fieldError(save.error, "summary")}>
          <textarea id="pp-summary" className={ui.textarea} maxLength={3000} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
          <legend className={ui.label}>Qui peut voir mon portfolio et mes projets ?</legend>
          <div className={layout.choices}>
            {PORTFOLIO_VISIBILITIES.map((v) => (
              <label key={v.value} className={layout.choice}>
                <input type="radio" name="pp-visibility" value={v.value} checked={visibility === v.value} onChange={() => setVisibility(v.value)} />
                <v.Icon aria-hidden="true" />
                <span>
                  <strong>{v.label}</strong>
                  <small>{v.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {save.isError && (
          <p className={ui.fieldError} role="alert">
            {describeError(save.error)}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
