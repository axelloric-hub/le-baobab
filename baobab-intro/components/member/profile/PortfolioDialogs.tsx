"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { usePortfolioMutations } from "@/features/people/mutations";
import { useReference } from "@/features/people/reference";
import { authed } from "@/lib/api/authed";
import { describeError, fieldError } from "@/lib/api/errors";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { CloseIcon } from "../ui/icons";
import { Spinner } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Profile.module.css";

export type AddKind = "projects" | "repositories" | "experiences" | "educations" | "achievements" | "certificates";

const TITLES: Record<AddKind, string> = {
  projects: "Ajouter un projet",
  repositories: "Ajouter un dépôt GitHub",
  experiences: "Ajouter une expérience",
  educations: "Ajouter une formation",
  achievements: "Ajouter une réalisation",
  certificates: "Afficher un certificat LE BAOBAB",
};

/** « 2024-03 » (champ mois) → « 2024-03-01 » (date attendue par l'API). */
const toDate = (month: string) => (month ? `${month}-01` : undefined);

const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "projet";

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className={ui.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && <p className={ui.hint}>{hint}</p>}
      {error && (
        <p className={ui.fieldError} id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Choix de technologies parmi le référentiel des compétences (recherche). */
export function SkillPicker({ value, onChange, max = 30 }: { value: Array<{ slug: string; name: string }>; onChange: (v: Array<{ slug: string; name: string }>) => void; max?: number }) {
  const [q, setQ] = useState("");
  const results = useReference("skills", q.trim().length >= 1 ? q.trim() : "");
  const options = (results.data ?? []).filter((s) => !value.some((v) => v.slug === s.slug)).slice(0, 12);
  return (
    <div>
      <input className={ui.input} type="search" placeholder="Rechercher : Python, Django, Docker…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une technologie" />
      {options.length > 0 && value.length < max && (
        <ul className={styles.suggestions} aria-label="Suggestions">
          {options.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                className={cx(ui.chip, ui.small)}
                onClick={() => {
                  onChange([...value, { slug: s.slug, name: s.name }]);
                  setQ("");
                }}
              >
                + {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <ul className={styles.suggestions} aria-label="Choisies">
          {value.map((s) => (
            <li key={s.slug}>
              <button type="button" className={ui.chip} data-active onClick={() => onChange(value.filter((v) => v.slug !== s.slug))} aria-label={`Retirer ${s.name}`}>
                {s.name}
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PortfolioDialog({ kind, username, onClose }: { kind: AddKind | null; username: string; onClose: () => void }) {
  return kind ? <AddDialog kind={kind} username={username} onClose={onClose} /> : null;
}

function AddDialog({ kind, username, onClose }: { kind: AddKind; username: string; onClose: () => void }) {
  const toast = useToast();
  const { add } = usePortfolioMutations(username);
  const [values, setValues] = useState<Record<string, string>>({});
  const [techs, setTechs] = useState<Array<{ slug: string; name: string }>>([]);
  const [current, setCurrent] = useState(true);
  const certificates = useQuery({
    queryKey: ["me", "certificates"],
    queryFn: () => authed<Array<{ id: string; course: string; verification_code: string; issued_at: string }>>("/me/certificates/"),
    enabled: kind === "certificates",
  });
  const v = (key: string) => values[key] ?? "";
  const set = (key: string) => (e: { target: { value: string } }) => setValues((s) => ({ ...s, [key]: e.target.value }));
  const err = (field: string) => fieldError(add.error, field);

  const body = (): Record<string, unknown> | null => {
    switch (kind) {
      case "projects": {
        const links = [
          v("repo") && { kind: "repository", url: v("repo") },
          v("demo") && { kind: "demo", url: v("demo") },
        ].filter(Boolean);
        return {
          title: v("title").trim(),
          slug: `${slugify(v("title"))}-${Date.now().toString(36).slice(-4)}`,
          description: v("description").trim(),
          role: v("role").trim(),
          technologies: techs.map((t) => t.slug),
          links,
          ...(toDate(v("start")) ? { started_on: toDate(v("start")) } : {}),
          ...(toDate(v("end")) ? { ended_on: toDate(v("end")) } : {}),
        };
      }
      case "repositories":
        return { url: v("url").trim() };
      case "experiences":
        return {
          company_name: v("company").trim(),
          title: v("title").trim(),
          location: v("location").trim(),
          started_on: toDate(v("start")),
          ...(!current && toDate(v("end")) ? { ended_on: toDate(v("end")) } : {}),
          description: v("description").trim(),
        };
      case "educations":
        return {
          institution: v("institution").trim(),
          degree: v("degree").trim(),
          field: v("field").trim(),
          ...(toDate(v("start")) ? { started_on: toDate(v("start")) } : {}),
          ...(toDate(v("end")) ? { ended_on: toDate(v("end")) } : {}),
        };
      case "achievements":
        return { title: v("title").trim(), issuer: v("issuer").trim(), ...(toDate(v("date")) ? { achieved_on: toDate(v("date")) } : {}), ...(v("url") ? { url: v("url").trim() } : {}) };
      case "certificates":
        return v("certificate") ? { certificate_id: v("certificate") } : null;
    }
  };

  const ready =
    kind === "projects"
      ? Boolean(v("title").trim())
      : kind === "repositories"
        ? /github\.com\/[^/\s]+\/[^/\s]+/.test(v("url"))
        : kind === "experiences"
          ? Boolean(v("company").trim() && v("title").trim() && v("start"))
          : kind === "educations"
            ? Boolean(v("institution").trim())
            : kind === "achievements"
              ? Boolean(v("title").trim())
              : Boolean(v("certificate"));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const payload = body();
    if (!payload || !ready) return;
    add.mutate(
      { kind: kind === "repositories" ? "repositories/from-url" : kind, body: payload },
      {
        onSuccess: () => {
          toast("Ajouté à votre profil.", { tone: "success" });
          onClose();
        },
      },
    );
  };

  const monthInput = (id: string, key: string, label: string, disabled = false) => (
    <Field id={id} label={label} error={err(key === "start" ? "started_on" : key === "end" ? "ended_on" : "achieved_on")}>
      <input id={id} className={ui.input} type="month" value={v(key)} onChange={set(key)} disabled={disabled} max={new Date().toISOString().slice(0, 7)} />
    </Field>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      busy={add.isPending}
      title={TITLES[kind]}
      footer={
        <>
          <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={add.isPending}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={() => submit()} disabled={!ready || add.isPending}>
            {add.isPending ? "Enregistrement…" : "Ajouter"}
          </button>
        </>
      }
    >
      <form className={styles.form} onSubmit={submit}>
        {kind === "projects" && (
          <>
            <Field id="pf-title" label="Nom du projet" error={err("title") ?? err("slug")}>
              <input id="pf-title" data-autofocus className={ui.input} maxLength={160} value={v("title")} onChange={set("title")} />
            </Field>
            <Field id="pf-role" label="Votre rôle (facultatif)" error={err("role")}>
              <input id="pf-role" className={ui.input} maxLength={100} placeholder="ex. : Développeuse backend principale" value={v("role")} onChange={set("role")} />
            </Field>
            <Field id="pf-description" label="Description (facultatif)" error={err("description")}>
              <textarea id="pf-description" className={ui.textarea} maxLength={10000} value={v("description")} onChange={set("description")} />
            </Field>
            <div>
              <span className={ui.label}>Technologies</span>
              <SkillPicker value={techs} onChange={setTechs} />
            </div>
            <div className={styles.row2}>
              <Field id="pf-repo" label="Dépôt de code (facultatif)" error={err("links")}>
                <input id="pf-repo" className={ui.input} type="url" inputMode="url" placeholder="https://github.com/…" value={v("repo")} onChange={set("repo")} />
              </Field>
              <Field id="pf-demo" label="Démo ou site (facultatif)">
                <input id="pf-demo" className={ui.input} type="url" inputMode="url" placeholder="https://" value={v("demo")} onChange={set("demo")} />
              </Field>
            </div>
            <div className={styles.row2}>
              {monthInput("pf-start", "start", "Début (facultatif)")}
              {monthInput("pf-end", "end", "Fin (facultatif)")}
            </div>
          </>
        )}

        {kind === "repositories" && (
          <Field id="pf-url" label="Adresse du dépôt" error={err("url")} hint="Collez l'adresse d'un dépôt public : le serveur le vérifie auprès de GitHub et récupère sa description, son langage et ses étoiles.">
            <input id="pf-url" data-autofocus className={ui.input} type="url" inputMode="url" placeholder="https://github.com/proprietaire/depot" value={v("url")} onChange={set("url")} />
          </Field>
        )}

        {kind === "experiences" && (
          <>
            <Field id="pf-xtitle" label="Poste" error={err("title")}>
              <input id="pf-xtitle" data-autofocus className={ui.input} maxLength={140} placeholder="ex. : Développeur backend" value={v("title")} onChange={set("title")} />
            </Field>
            <div className={styles.row2}>
              <Field id="pf-company" label="Entreprise ou organisation" error={err("company_name")}>
                <input id="pf-company" className={ui.input} maxLength={140} value={v("company")} onChange={set("company")} />
              </Field>
              <Field id="pf-location" label="Lieu (facultatif)" error={err("location")}>
                <input id="pf-location" className={ui.input} maxLength={100} placeholder="ex. : Dakar ou à distance" value={v("location")} onChange={set("location")} />
              </Field>
            </div>
            <label className={styles.checkLine}>
              <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
              J&apos;occupe ce poste actuellement
            </label>
            <div className={styles.row2}>
              {monthInput("pf-xstart", "start", "Début")}
              {monthInput("pf-xend", "end", "Fin", current)}
            </div>
            <Field id="pf-xdesc" label="Description (facultatif)" error={err("description")}>
              <textarea id="pf-xdesc" className={ui.textarea} maxLength={5000} value={v("description")} onChange={set("description")} />
            </Field>
          </>
        )}

        {kind === "educations" && (
          <>
            <Field id="pf-inst" label="Établissement" error={err("institution")}>
              <input id="pf-inst" data-autofocus className={ui.input} maxLength={160} value={v("institution")} onChange={set("institution")} />
            </Field>
            <div className={styles.row2}>
              <Field id="pf-degree" label="Diplôme (facultatif)" error={err("degree")}>
                <input id="pf-degree" className={ui.input} maxLength={140} placeholder="ex. : Licence, Master" value={v("degree")} onChange={set("degree")} />
              </Field>
              <Field id="pf-field" label="Domaine (facultatif)" error={err("field")}>
                <input id="pf-field" className={ui.input} maxLength={140} placeholder="ex. : Génie logiciel" value={v("field")} onChange={set("field")} />
              </Field>
            </div>
            <div className={styles.row2}>
              {monthInput("pf-estart", "start", "Début (facultatif)")}
              {monthInput("pf-eend", "end", "Fin (facultatif)")}
            </div>
          </>
        )}

        {kind === "achievements" && (
          <>
            <Field id="pf-atitle" label="Réalisation" error={err("title")}>
              <input id="pf-atitle" data-autofocus className={ui.input} maxLength={160} placeholder="ex. : 1er prix du hackathon…" value={v("title")} onChange={set("title")} />
            </Field>
            <div className={styles.row2}>
              <Field id="pf-issuer" label="Décernée par (facultatif)" error={err("issuer")}>
                <input id="pf-issuer" className={ui.input} maxLength={140} value={v("issuer")} onChange={set("issuer")} />
              </Field>
              {monthInput("pf-adate", "date", "Date (facultatif)")}
            </div>
            <Field id="pf-aurl" label="Lien (facultatif)" error={err("url")}>
              <input id="pf-aurl" className={ui.input} type="url" inputMode="url" placeholder="https://" value={v("url")} onChange={set("url")} />
            </Field>
          </>
        )}

        {kind === "certificates" &&
          (certificates.isPending ? (
            <Spinner label="Chargement de vos certificats" />
          ) : (certificates.data ?? []).length === 0 ? (
            <p className={styles.empty}>Vous n&apos;avez pas encore de certificat LE BAOBAB. Ils sont délivrés à la fin des cours Learn qui en proposent.</p>
          ) : (
            <fieldset style={{ margin: 0, padding: 0, border: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <legend className={ui.label}>Choisissez le certificat à afficher</legend>
              {certificates.data!.map((c) => (
                <label key={c.id} className={styles.checkLine} style={{ padding: "10px 12px", border: "1px solid var(--bb-line)", borderRadius: 12 }}>
                  <input type="radio" name="certificate" value={c.id} checked={v("certificate") === c.id} onChange={set("certificate")} />
                  <span>
                    <strong>{c.course}</strong>
                    <br />
                    <small style={{ color: "var(--bb-ink-muted)" }}>Code de vérification : {c.verification_code}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}

        {add.isError && !Object.keys((add.error as { fields?: object })?.fields ?? {}).length && (
          <p className={ui.fieldError} role="alert">
            {describeError(add.error)}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
