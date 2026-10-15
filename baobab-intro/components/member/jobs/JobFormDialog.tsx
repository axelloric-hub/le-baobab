"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { jobsApi } from "@/features/jobs/api";
import { jobKeys, useMyCompanies, useSaveJob } from "@/features/jobs/hooks";
import type { ContractType, Job, JobInput, JobType, Level, Period, Remote } from "@/features/jobs/types";
import { useReference } from "@/features/people/reference";
import { describeError, fieldError } from "@/lib/api/errors";
import { CURRENCIES, PERIOD_LABELS, toInput, toMinor } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { SkillPicker } from "../profile/PortfolioDialogs";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { PlusIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { CompanyFormDialog } from "./CompanyFormDialog";
import { CONTRACTS, CONTRACTS_FOR, JOB_TYPES, LEVELS, RECRUITER_ROLES, REMOTE } from "./labels";
import styles from "./Jobs.module.css";

const DESCRIPTION_MIN = 50;

/** Publier une offre (création) ou modifier une offre existante (job fourni). */
export function JobFormDialog({ open, onClose, job, company }: { open: boolean; onClose: () => void; job?: Job; company?: string }) {
  return open ? <JobForm onClose={onClose} job={job} initialCompany={company} /> : null;
}

function JobForm({ onClose, job, initialCompany }: { onClose: () => void; job?: Job; initialCompany?: string }) {
  const router = useRouter();
  const toast = useToast();
  const client = useQueryClient();
  const save = useSaveJob(job?.id);
  const companies = useMyCompanies();
  const countries = useReference("countries");
  const recruiterOf = useMemo(() => (companies.data ?? []).filter((c) => RECRUITER_ROLES.includes(c.role)), [companies.data]);

  const [jobType, setJobType] = useState<JobType>(job?.job_type ?? "full_time");
  const [contract, setContract] = useState<ContractType>(job?.contract_type ?? "permanent");
  const [company, setCompany] = useState(job?.company?.slug ?? initialCompany ?? "");
  const [title, setTitle] = useState(job?.title ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [level, setLevel] = useState<Level>(job?.experience_level ?? "mid");
  const [remote, setRemote] = useState<Remote>(job?.remote_policy ?? "onsite");
  const [country, setCountry] = useState(job?.country ?? "");
  const [city, setCity] = useState(job?.city ?? "");
  const [skills, setSkills] = useState<Array<{ slug: string; name: string }>>(job?.skills.map((s) => ({ slug: s.slug, name: s.name })) ?? []);
  const [optional, setOptional] = useState<Set<string>>(new Set(job?.skills.filter((s) => !s.required).map((s) => s.slug)));
  const currency0 = job?.salary?.currency ?? "XAF";
  const [salary, setSalary] = useState({
    min: toInput(job?.salary?.min_minor, currency0),
    max: toInput(job?.salary?.max_minor, currency0),
    currency: currency0,
    period: (job?.salary?.period ?? "month") as Period,
  });
  const [deadline, setDeadline] = useState(job?.deadline ? job.deadline.slice(0, 10) : "");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const editing = Boolean(job);
  const freelance = jobType === "freelance";
  const contracts = CONTRACTS_FOR[jobType];
  const effectiveContract = contracts.includes(contract) ? contract : contracts[0];
  const effectiveCompany = freelance ? company : company || recruiterOf[0]?.slug || "";

  // Salaire : facultatif, mais complet et cohérent s'il est commencé.
  const salaryStarted = Boolean(salary.min || salary.max);
  const minMinor = toMinor(salary.min, salary.currency);
  const maxMinor = toMinor(salary.max || salary.min, salary.currency);
  const salaryError = salaryStarted && (minMinor === null || maxMinor === null) ? "Saisissez des montants en chiffres." : salaryStarted && minMinor! > maxMinor! ? "Le minimum dépasse le maximum." : undefined;

  const missing = !title.trim()
    ? "Donnez un intitulé à l'offre."
    : description.trim().length < 10
      ? "Décrivez l'offre."
      : !freelance && !effectiveCompany
        ? "Une offre d'emploi est publiée au nom d'une entreprise : créez-la ou choisissez-la."
        : salaryError
          ? salaryError
          : null;
  const publishMissing =
    description.trim().length < DESCRIPTION_MIN ? `La description doit faire au moins ${DESCRIPTION_MIN} caractères pour être publiée.` : skills.length === 0 ? "Ajoutez au moins une compétence pour publier." : null;

  const input = (): JobInput => ({
    ...(editing ? {} : { company: effectiveCompany || undefined, job_type: jobType, contract_type: effectiveContract }),
    title: title.trim(),
    description: description.trim(),
    experience_level: level,
    remote_policy: remote,
    country: country || (editing ? null : undefined),
    city: city.trim(),
    salary: salaryStarted ? { min: minMinor!, max: maxMinor!, currency: salary.currency, period: salary.period } : editing ? null : undefined,
    skills: skills.map((s) => ({ slug: s.slug, required: !optional.has(s.slug) })),
    deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : editing ? null : undefined,
  } as JobInput);

  const submit = async (publish: boolean) => {
    if (missing || save.isPending || publishing) return;
    try {
      const saved = await save.mutateAsync(input());
      if (publish) {
        setPublishing(true);
        const published = await jobsApi.publish(saved.id);
        client.setQueryData(jobKeys.detail(saved.id), published);
        void client.invalidateQueries({ queryKey: jobKeys.all });
      }
      toast(publish ? "Offre publiée." : editing ? "Offre mise à jour." : "Brouillon enregistré : publiez-le quand il est prêt.", { tone: "success" });
      onClose();
      if (!editing) router.push(ROUTES.job(saved.id));
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    } finally {
      setPublishing(false);
    }
  };

  const busy = save.isPending || publishing;
  const canPublishNow = !editing || job?.status === "draft";

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={editing ? "Modifier l'offre" : "Publier une offre"}
      footer={
        <>
          <span className={ui.hint} style={{ marginRight: "auto", marginTop: 0 }} aria-live="polite">
            {missing ?? (canPublishNow ? publishMissing : null) ?? ""}
          </span>
          {canPublishNow && (
            <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => submit(false)} disabled={Boolean(missing) || busy}>
              {editing ? "Enregistrer" : "Enregistrer le brouillon"}
            </button>
          )}
          <button
            type="button"
            className={cx(ui.button, ui.primary)}
            onClick={() => submit(canPublishNow)}
            disabled={Boolean(missing) || (canPublishNow && Boolean(publishMissing)) || busy}
          >
            {busy ? "Envoi…" : canPublishNow ? "Publier" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form className={layout.form} onSubmit={(e: FormEvent) => e.preventDefault()} noValidate>
        {!editing && (
          <fieldset className={layout.choices}>
            <legend className={ui.label}>Type d&apos;offre</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Object.keys(JOB_TYPES) as JobType[]).map((value) => (
                <button key={value} type="button" className={ui.chip} aria-pressed={jobType === value} onClick={() => setJobType(value)}>
                  {JOB_TYPES[value]}
                </button>
              ))}
            </div>
            <p className={ui.hint}>
              {freelance
                ? "Une mission freelance peut être publiée à titre personnel : les développeurs vous envoient une proposition chiffrée."
                : "Une offre d'emploi ou de stage est publiée au nom d'une entreprise dont vous êtes recruteur."}
            </p>
          </fieldset>
        )}

        {!editing && (
          <Field id="job-company" label={freelance ? "Publier au nom de" : "Entreprise"} hint={freelance ? undefined : recruiterOf.length === 0 ? "Vous n'êtes recruteur d'aucune entreprise : créez la page de la vôtre." : undefined}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(freelance || recruiterOf.length > 0) && (
                <select id="job-company" className={ui.select} style={{ flex: "1 1 220px" }} value={effectiveCompany} onChange={(e) => setCompany(e.target.value)}>
                  {freelance && <option value="">Moi-même (mission individuelle)</option>}
                  {recruiterOf.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setCreatingCompany(true)}>
                <PlusIcon />
                Créer une entreprise
              </button>
            </div>
          </Field>
        )}

        <Field id="job-title" label="Intitulé" error={fieldError(save.error, "title")}>
          <input id="job-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Développeur·se backend Django" />
        </Field>

        <Field
          id="job-description"
          label="Description"
          error={fieldError(save.error, "description")}
          hint={`Missions, environnement technique, profil recherché, déroulé du recrutement. ${description.trim().length} caractères (${DESCRIPTION_MIN} au moins pour publier).`}
        >
          <textarea id="job-description" className={ui.textarea} style={{ minHeight: 180 }} maxLength={20000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className={styles.twoCols}>
          {!editing && contracts.length > 1 && (
            <Field id="job-contract" label="Contrat">
              <select id="job-contract" className={ui.select} value={effectiveContract} onChange={(e) => setContract(e.target.value as ContractType)}>
                {contracts.map((value) => (
                  <option key={value} value={value}>
                    {CONTRACTS[value]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field id="job-level" label="Niveau d'expérience">
            <select id="job-level" className={ui.select} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {(Object.keys(LEVELS) as Level[]).map((value) => (
                <option key={value} value={value}>
                  {LEVELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="job-remote" label="Lieu de travail">
            <select id="job-remote" className={ui.select} value={remote} onChange={(e) => setRemote(e.target.value as Remote)}>
              {(Object.keys(REMOTE) as Remote[]).map((value) => (
                <option key={value} value={value}>
                  {REMOTE[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="job-country" label="Pays" optional>
            <select id="job-country" className={ui.select} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Non précisé</option>
              {(countries.data ?? []).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="job-city" label="Ville" optional>
            <input id="job-city" className={ui.input} maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Douala, Dakar, Lagos…" />
          </Field>
        </div>

        <div>
          <span className={ui.label}>Compétences</span>
          <SkillPicker value={skills} onChange={setSkills} />
          {skills.length > 0 && (
            <fieldset className={layout.choices} style={{ marginTop: 10 }}>
              <legend className={ui.hint} style={{ margin: "0 0 4px" }}>
                Décochez celles qui sont un plus mais pas indispensables.
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                {skills.map((s) => (
                  <label key={s.slug} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={!optional.has(s.slug)}
                      onChange={(e) =>
                        setOptional((set) => {
                          const next = new Set(set);
                          if (e.target.checked) next.delete(s.slug);
                          else next.add(s.slug);
                          return next;
                        })
                      }
                    />
                    {s.name} indispensable
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <fieldset className={layout.choices}>
          <legend className={ui.label}>
            {freelance ? "Budget" : "Rémunération"} <span style={{ fontWeight: 500, color: "var(--bb-ink-muted)" }}>(facultatif, mais les offres chiffrées attirent plus de candidats)</span>
          </legend>
          <div className={styles.twoCols}>
            <input className={ui.input} inputMode="decimal" placeholder="Minimum" aria-label="Minimum" value={salary.min} onChange={(e) => setSalary((s) => ({ ...s, min: e.target.value }))} />
            <input className={ui.input} inputMode="decimal" placeholder="Maximum" aria-label="Maximum" value={salary.max} onChange={(e) => setSalary((s) => ({ ...s, max: e.target.value }))} />
            <select className={ui.select} aria-label="Devise" value={salary.currency} onChange={(e) => setSalary((s) => ({ ...s, currency: e.target.value }))}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select className={ui.select} aria-label="Période" value={salary.period} onChange={(e) => setSalary((s) => ({ ...s, period: e.target.value as Period }))}>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <option key={p} value={p}>
                  par {PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {salaryError && <p className={ui.fieldError}>{salaryError}</p>}
        </fieldset>

        <Field id="job-deadline" label="Date limite de candidature" optional>
          <input id="job-deadline" type="date" className={ui.input} value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </form>

      <CompanyFormDialog
        open={creatingCompany}
        onClose={() => setCreatingCompany(false)}
        onCreated={(c) => setCompany(c.slug)}
      />
    </Dialog>
  );
}
