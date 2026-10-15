"use client";

import { useRef, useState } from "react";
import { useApply, usePropose } from "@/features/jobs/hooks";
import type { Job } from "@/features/jobs/types";
import { useMe } from "@/features/me/me";
import { usePortfolio } from "@/features/people/hooks";
import { describeError, fieldError } from "@/lib/api/errors";
import { CURRENCIES, toMinor } from "@/lib/money";
import { checkFile, uploadFile } from "@/lib/uploads/upload";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { CheckIcon, FileIcon, TrashIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Jobs.module.css";

const https = (v: string) => !v || /^https:\/\/\S+\.\S+/.test(v);

/* ------------------------------------------------------------------ */
/* Candidature                                                         */
/* ------------------------------------------------------------------ */

export function ApplyDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  return open ? <Apply job={job} onClose={onClose} /> : null;
}

function Apply({ job, onClose }: { job: Job; onClose: () => void }) {
  const toast = useToast();
  const apply = useApply(job);
  const me = useMe();
  const portfolio = usePortfolio(me.data?.username ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [letter, setLetter] = useState("");
  const [cv, setCv] = useState<{ name: string; id?: string; progress: number; error?: string } | null>(null);
  const [links, setLinks] = useState({ portfolio_url: "", github_url: "", gitlab_url: "" });
  const [projects, setProjects] = useState<string[]>([]);
  const [available, setAvailable] = useState("");

  const pickCv = async (file: File) => {
    const problem = await checkFile(file, "cv").catch(() => null);
    if (problem) {
      setCv({ name: file.name, progress: 0, error: problem });
      return;
    }
    setCv({ name: file.name, progress: 0 });
    try {
      const id = await uploadFile(file, "cv", { onProgress: (progress) => setCv((c) => (c ? { ...c, progress } : c)) });
      setCv({ name: file.name, id, progress: 1 });
    } catch (error) {
      setCv({ name: file.name, progress: 0, error: describeError(error) });
    }
  };

  const linkError = (Object.entries(links).find(([, v]) => !https(v.trim()))?.[0] as keyof typeof links | undefined) ?? null;
  const uploading = Boolean(cv && !cv.id && !cv.error);
  const missing = !letter.trim() && !cv?.id ? "Ajoutez une lettre de motivation ou votre CV." : linkError ? "Les liens doivent commencer par https://" : uploading ? "Envoi du CV en cours…" : null;

  const submit = () => {
    if (missing || apply.isPending) return;
    apply.mutate(
      {
        cover_letter: letter.trim(),
        cv_file: cv?.id,
        portfolio_url: links.portfolio_url.trim() || undefined,
        github_url: links.github_url.trim() || undefined,
        gitlab_url: links.gitlab_url.trim() || undefined,
        projects: projects.length ? projects : undefined,
        available_from: available || undefined,
      },
      {
        onSuccess: () => {
          toast("Candidature envoyée. Suivez son avancement sur cette page.", { tone: "success" });
          onClose();
        },
      },
    );
  };

  const myProjects = portfolio.data?.projects ?? [];

  return (
    <Dialog
      open
      onClose={onClose}
      busy={apply.isPending}
      size="lg"
      title={`Postuler : ${job.title}`}
      footer={
        <>
          <span className={ui.hint} style={{ marginRight: "auto", marginTop: 0 }} aria-live="polite">
            {missing ?? ""}
          </span>
          <button type="button" className={cx(ui.button, ui.ghost, ui.hideOnMobile)} onClick={onClose} disabled={apply.isPending}>
            Annuler
          </button>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={submit} disabled={Boolean(missing) || apply.isPending}>
            {apply.isPending ? "Envoi…" : "Envoyer ma candidature"}
          </button>
        </>
      }
    >
      <div className={layout.form}>
        <Field id="apply-letter" label="Lettre de motivation" hint="Pourquoi ce poste, ce que vous apporteriez, vos réalisations les plus proches." error={fieldError(apply.error, "cover_letter")}>
          <textarea id="apply-letter" data-autofocus className={ui.textarea} style={{ minHeight: 160 }} maxLength={10000} value={letter} onChange={(e) => setLetter(e.target.value)} />
        </Field>

        <div>
          <span className={ui.label}>CV (PDF ou Word, facultatif si la lettre suffit)</span>
          {cv ? (
            <div className={styles.milestone}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FileIcon width={18} height={18} aria-hidden="true" />
                {cv.name}
              </span>
              {cv.error ? (
                <span className={ui.fieldError} style={{ margin: 0 }}>
                  {cv.error}
                </span>
              ) : cv.id ? (
                <span style={{ color: "#166534", display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <CheckIcon width={16} height={16} aria-hidden="true" />
                  Envoyé
                </span>
              ) : (
                <span role="status">Envoi… {Math.round(cv.progress * 100)} %</span>
              )}
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => setCv(null)}>
                <TrashIcon />
                Retirer
              </button>
            </div>
          ) : (
            <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => fileRef.current?.click()}>
              <FileIcon />
              Joindre mon CV
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pickCv(file);
            }}
          />
        </div>

        <div className={styles.twoCols}>
          <Field id="apply-github" label="GitHub" optional error={linkError === "github_url" ? "Commencez par https://" : undefined}>
            <input id="apply-github" className={ui.input} type="url" inputMode="url" placeholder="https://github.com/…" value={links.github_url} onChange={(e) => setLinks((l) => ({ ...l, github_url: e.target.value }))} />
          </Field>
          <Field id="apply-portfolio" label="Portfolio ou site" optional error={linkError === "portfolio_url" ? "Commencez par https://" : undefined}>
            <input id="apply-portfolio" className={ui.input} type="url" inputMode="url" placeholder="https://" value={links.portfolio_url} onChange={(e) => setLinks((l) => ({ ...l, portfolio_url: e.target.value }))} />
          </Field>
          <Field id="apply-gitlab" label="GitLab" optional error={linkError === "gitlab_url" ? "Commencez par https://" : undefined}>
            <input id="apply-gitlab" className={ui.input} type="url" inputMode="url" placeholder="https://gitlab.com/…" value={links.gitlab_url} onChange={(e) => setLinks((l) => ({ ...l, gitlab_url: e.target.value }))} />
          </Field>
          <Field id="apply-available" label="Disponible à partir du" optional>
            <input id="apply-available" type="date" className={ui.input} value={available} onChange={(e) => setAvailable(e.target.value)} />
          </Field>
        </div>

        {myProjects.length > 0 && (
          <fieldset className={layout.choices}>
            <legend className={ui.label}>Joindre des projets de mon portfolio</legend>
            {myProjects.slice(0, 10).map((p) => (
              <label key={p.id} className={layout.choice}>
                <input
                  type="checkbox"
                  checked={projects.includes(p.id)}
                  onChange={(e) => setProjects((list) => (e.target.checked ? [...list, p.id] : list.filter((id) => id !== p.id)))}
                />
                <span>
                  <strong>{p.title}</strong>
                  {p.description && <small>{p.description.slice(0, 120)}</small>}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {apply.error && (
          <p className={ui.fieldError} role="alert">
            {describeError(apply.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition (mission freelance)                                     */
/* ------------------------------------------------------------------ */

export function ProposalDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  return open ? <Propose job={job} onClose={onClose} /> : null;
}

function Propose({ job, onClose }: { job: Job; onClose: () => void }) {
  const toast = useToast();
  const propose = usePropose(job);
  const [letter, setLetter] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(job.salary?.currency ?? "XAF");
  const [days, setDays] = useState("");
  const bid = toMinor(amount, currency);
  const delivery = Number(days);
  const missing = !letter.trim()
    ? "Présentez votre approche."
    : !bid || bid < 1
      ? "Indiquez votre prix."
      : !Number.isInteger(delivery) || delivery < 1 || delivery > 3650
        ? "Indiquez un délai en jours."
        : null;

  const submit = () => {
    if (missing || propose.isPending) return;
    propose.mutate(
      { cover_letter: letter.trim(), bid_minor: bid!, currency, delivery_days: delivery },
      {
        onSuccess: () => {
          toast("Proposition envoyée.", { tone: "success" });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={propose.isPending}
      title="Envoyer une proposition"
      footer={
        <>
          <span className={ui.hint} style={{ marginRight: "auto", marginTop: 0 }} aria-live="polite">
            {missing ?? ""}
          </span>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={submit} disabled={Boolean(missing) || propose.isPending}>
            {propose.isPending ? "Envoi…" : "Envoyer"}
          </button>
        </>
      }
    >
      <div className={layout.form}>
        <Field id="proposal-letter" label="Votre approche" hint="Comment vous réaliseriez la mission, vos réalisations comparables, vos questions.">
          <textarea id="proposal-letter" data-autofocus className={ui.textarea} style={{ minHeight: 150 }} maxLength={10000} value={letter} onChange={(e) => setLetter(e.target.value)} />
        </Field>
        <div className={styles.twoCols}>
          <Field id="proposal-amount" label="Prix total">
            <div className={styles.amountField}>
              <input id="proposal-amount" className={ui.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250 000" />
              <select className={ui.select} aria-label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field id="proposal-days" label="Délai de livraison (jours)">
            <input id="proposal-days" className={ui.input} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} placeholder="14" />
          </Field>
        </div>
        {propose.error && (
          <p className={ui.fieldError} role="alert">
            {describeError(propose.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
