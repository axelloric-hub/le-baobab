"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAcceptProposal, useApplication, useCreateSlot, useJob, useJobApplications, useJobProposals, useMakeOffer, useSlots, useTransition } from "@/features/jobs/hooks";
import type { Application, ApplicationStatus, Job, Period, Proposal } from "@/features/jobs/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { relativeTime } from "@/lib/format";
import { CURRENCIES, formatMoney, PERIOD_LABELS, toMinor } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { ArrowLeftIcon, CalendarIcon, ExternalIcon, FileIcon, LockIcon, PlusIcon, SendIcon, UsersIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { History, InterviewInfo, slotLabel, Steps } from "./ApplicationTracker";
import { APPLICATION_STATUS, PROPOSAL_STATUS, RECRUITER_NEXT, TRANSITION_LABELS } from "./labels";
import styles from "./Jobs.module.css";

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Toutes" },
  { value: "submitted", label: "À examiner" },
  { value: "reviewing", label: "En examen" },
  { value: "shortlisted", label: "Présélectionnées" },
  { value: "interview", label: "Entretien" },
  { value: "offer", label: "Offre envoyée" },
  { value: "hired", label: "Embauchées" },
  { value: "rejected", label: "Non retenues" },
];

/* ------------------------------------------------------------------ */
/* Créneaux d'entretien                                                */
/* ------------------------------------------------------------------ */

function SlotsCard({ job }: { job: Job }) {
  const toast = useToast();
  const slots = useSlots(job.id, true);
  const create = useCreateSlot(job.id);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState(45);
  const add = () => {
    if (!date || !time) return;
    const start = new Date(`${date}T${time}:00`);
    if (start.getTime() < Date.now()) {
      toast("Choisissez un moment à venir.", { tone: "error" });
      return;
    }
    const end = new Date(start.getTime() + minutes * 60_000);
    create.mutate(
      { starts_at: start.toISOString(), ends_at: end.toISOString() },
      { onSuccess: () => toast("Créneau ajouté.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) },
    );
  };
  const free = slots.data ?? [];
  return (
    <section className={layout.panelCard} aria-labelledby="creneaux">
      <h2 id="creneaux" className={layout.panelTitle}>
        <CalendarIcon aria-hidden="true" />
        Créneaux d&apos;entretien
      </h2>
      <p className={ui.hint} style={{ marginTop: 0 }}>
        Les candidats présélectionnés choisissent eux-mêmes parmi les créneaux libres.
      </p>
      {slots.isPending ? (
        <Skeleton height={40} radius={10} />
      ) : free.length === 0 ? (
        <p className={ui.hint}>Aucun créneau libre.</p>
      ) : (
        <ul className={layout.stack} style={{ gap: 6, margin: "0 0 12px", padding: 0, listStyle: "none", fontSize: 14 }}>
          {free.map((s) => (
            <li key={s.id}>{slotLabel(s)}</li>
          ))}
        </ul>
      )}
      <div className={layout.stack} style={{ gap: 8 }}>
        <div className={styles.twoCols}>
          <input type="date" className={ui.input} aria-label="Jour" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          <input type="time" className={ui.input} aria-label="Heure de début" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <select className={ui.select} aria-label="Durée" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </select>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={add} disabled={!date || create.isPending}>
          <PlusIcon />
          Ajouter le créneau
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Offre d'embauche                                                    */
/* ------------------------------------------------------------------ */

function OfferForm({ job, application, onDone }: { job: Job; application: Application; onDone: () => void }) {
  const toast = useToast();
  const make = useMakeOffer(job.id, application.id);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(job.salary?.currency ?? "XAF");
  const [period, setPeriod] = useState<Period>(job.salary?.period ?? "month");
  const [start, setStart] = useState("");
  const [days, setDays] = useState(7);
  const minor = toMinor(amount, currency);
  return (
    <div className={styles.callout}>
      <p>
        <strong>Envoyer une offre d&apos;embauche</strong>
      </p>
      <div className={styles.twoCols}>
        <Field id="offer-amount" label="Rémunération">
          <div className={styles.amountField}>
            <input id="offer-amount" className={ui.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className={ui.select} aria-label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field id="offer-period" label="Par">
          <select id="offer-period" className={ui.select} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="offer-start" label="Date de début" optional>
          <input id="offer-start" type="date" className={ui.input} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field id="offer-valid" label="Valable">
          <select id="offer-valid" className={ui.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} jours
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={styles.calloutActions}>
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          disabled={!minor || make.isPending}
          onClick={() =>
            make.mutate(
              { amount_minor: minor!, currency, period, start_date: start || undefined, valid_days: days },
              {
                onSuccess: () => {
                  toast("Offre envoyée au candidat.", { tone: "success" });
                  onDone();
                },
                onError: (e) => toast(describeError(e), { tone: "error" }),
              },
            )
          }
        >
          <SendIcon />
          Envoyer l&apos;offre
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Examen d'une candidature                                            */
/* ------------------------------------------------------------------ */

function ReviewDialog({ job, applicationId, onClose }: { job: Job; applicationId: string; onClose: () => void }) {
  const toast = useToast();
  const query = useApplication(applicationId);
  const transition = useTransition(job.id);
  const [offering, setOffering] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const a = query.data;
  const name = a?.applicant ? a.applicant.display_name || a.applicant.username : "Candidature";
  const next = a ? (RECRUITER_NEXT[a.status] ?? []).filter((s) => s !== "rejected") : [];
  const canReject = a ? (RECRUITER_NEXT[a.status] ?? []).includes("rejected") : false;
  const interview = a?.interviews.find((i) => i.status === "scheduled");

  const move = (to: ApplicationStatus) =>
    transition.mutate(
      { id: applicationId, to },
      {
        onSuccess: () => {
          setRejecting(false);
          toast(`Candidature : ${APPLICATION_STATUS[to].label.toLowerCase()}.`, { tone: "success" });
        },
        onError: (e) => toast(describeError(e), { tone: "error" }),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      busy={transition.isPending}
      title={name}
      leading={a?.applicant && <Avatar name={name} src={a.applicant.avatar_url} size={36} />}
      footer={
        a && (next.length > 0 || canReject) ? (
          <>
            {canReject && (
              <button type="button" className={cx(ui.button, ui.ghost)} onClick={() => setRejecting(true)} disabled={transition.isPending} style={{ marginRight: "auto" }}>
                Ne pas retenir
              </button>
            )}
            {next.map((to) => (
              <button key={to} type="button" className={cx(ui.button, ui.primary)} onClick={() => move(to)} disabled={transition.isPending}>
                {TRANSITION_LABELS[to] ?? APPLICATION_STATUS[to].label}
              </button>
            ))}
          </>
        ) : undefined
      }
    >
      {!a ? (
        query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <Spinner label="Chargement de la candidature" />
        )
      ) : (
        <div className={layout.stack} style={{ gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <Pill tone={APPLICATION_STATUS[a.status].tone} dot>
              {APPLICATION_STATUS[a.status].label}
            </Pill>
            {a.applicant && (
              <Link href={ROUTES.profile(a.applicant.username)} className={cx(ui.button, ui.secondary, ui.small)}>
                Voir le profil
                <ExternalIcon />
              </Link>
            )}
          </div>
          <Steps status={a.status} history={a.history} />
          {a.status === "shortlisted" && !interview && (
            <div className={styles.callout}>
              <p>Présélectionné(e) : le candidat choisit un créneau parmi ceux que vous proposez (colonne « Créneaux d&apos;entretien »). Vous pouvez aussi passer directement en entretien.</p>
            </div>
          )}
          {interview && <InterviewInfo interview={interview} />}
          {a.status === "interview" &&
            !a.offer &&
            (offering ? (
              <OfferForm job={job} application={a} onDone={() => setOffering(false)} />
            ) : (
              <button type="button" className={cx(ui.button, ui.primary)} style={{ alignSelf: "flex-start" }} onClick={() => setOffering(true)}>
                <SendIcon />
                Faire une offre
              </button>
            ))}
          {a.offer && (
            <div className={styles.callout} data-tone={a.offer.status === "accepted" ? "green" : undefined}>
              <p>
                Offre de <strong>{formatMoney(a.offer.amount_minor, a.offer.currency)}</strong> par {PERIOD_LABELS[a.offer.period] ?? a.offer.period} —{" "}
                {a.offer.status === "sent" ? "en attente de réponse" : a.offer.status === "accepted" ? "acceptée" : "refusée"}.
              </p>
            </div>
          )}
          <div className={styles.twoCols} style={{ fontSize: 14, color: "var(--bb-ink-soft)" }}>
            <span>Reçue {relativeTime(a.created_at)}</span>
            {a.available_from && <span>Disponible le {new Date(a.available_from).toLocaleDateString("fr", { day: "numeric", month: "long", year: "numeric" })}</span>}
            {a.expected_salary_minor != null && job.salary && <span>Prétentions : {formatMoney(a.expected_salary_minor, job.salary.currency)}</span>}
          </div>
          {a.cover_letter && (
            <section>
              <h3 className={styles.sectionHeading}>Lettre de motivation</h3>
              <p className={styles.letter}>{a.cover_letter}</p>
            </section>
          )}
          {(a.cv_url || a.github_url || a.gitlab_url || a.portfolio_url) && (
            <ul className={styles.linkList}>
              {a.cv_url && (
                <li>
                  <a className={cx(ui.button, ui.secondary, ui.small)} href={a.cv_url} target="_blank" rel="noreferrer noopener">
                    <FileIcon />
                    CV
                  </a>
                </li>
              )}
              {(
                [
                  ["GitHub", a.github_url],
                  ["GitLab", a.gitlab_url],
                  ["Portfolio", a.portfolio_url],
                ] as const
              )
                .filter(([, url]) => url)
                .map(([label, url]) => (
                  <li key={label}>
                    <a className={cx(ui.button, ui.secondary, ui.small)} href={url} target="_blank" rel="noreferrer noopener">
                      {label}
                      <ExternalIcon />
                    </a>
                  </li>
                ))}
            </ul>
          )}
          {a.projects.length > 0 && (
            <section>
              <h3 className={styles.sectionHeading}>Projets joints</h3>
              <ul className={styles.skills}>
                {a.projects.map((p) => (
                  <li key={p.id} className={styles.skill}>
                    {p.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className={styles.sectionHeading}>Historique</h3>
            <History history={a.history} />
          </section>
        </div>
      )}
      <ConfirmDialog
        open={rejecting}
        busy={transition.isPending}
        onClose={() => setRejecting(false)}
        title="Ne pas retenir cette candidature ?"
        text="Le candidat est prévenu que sa candidature n'est pas retenue. Ce choix est définitif."
        confirm="Ne pas retenir"
        onConfirm={() => move("rejected")}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Listes                                                              */
/* ------------------------------------------------------------------ */

function ApplicationsList({ job }: { job: Job }) {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const apps = useJobApplications(job.id, status, true);
  const list = useMemo(() => apps.data?.pages.flatMap((p) => p.results) ?? [], [apps.data]);
  return (
    <>
      <div className={layout.chips} role="group" aria-label="Filtrer par étape">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className={ui.chip} aria-pressed={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {apps.isPending ? (
        <Skeleton height={180} radius={18} />
      ) : apps.isError ? (
        <ErrorState error={apps.error} onRetry={() => apps.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title={status ? "Aucune candidature à cette étape" : "Aucune candidature pour l'instant"} text={status ? undefined : "Partagez le lien de l'offre pour la faire connaître."} />
      ) : (
        <ul className={layout.people} aria-label="Candidatures">
          {list.map((a) => {
            const name = a.applicant ? a.applicant.display_name || a.applicant.username : "—";
            const st = APPLICATION_STATUS[a.status];
            return (
              <li key={a.id}>
                <button type="button" className={styles.applicant} onClick={() => setOpen(a.id)} aria-haspopup="dialog">
                  <Avatar name={name} src={a.applicant?.avatar_url} size={40} />
                  <span style={{ minWidth: 0 }}>
                    <span className={styles.applicantName}>{name}</span>
                    <span className={styles.applicantMeta}>
                      @{a.applicant?.username} · {relativeTime(a.created_at)}
                      {a.cv_url ? " · CV" : ""}
                      {a.projects.length ? ` · ${a.projects.length} projet${a.projects.length > 1 ? "s" : ""}` : ""}
                    </span>
                  </span>
                  <Pill tone={st.tone} dot>
                    {st.label}
                  </Pill>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {apps.hasNextPage && (
        <div className={layout.more}>
          <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => apps.fetchNextPage()} disabled={apps.isFetchingNextPage}>
            Afficher plus
          </button>
        </div>
      )}
      {open && <ReviewDialog job={job} applicationId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ProposalsList({ job }: { job: Job }) {
  const toast = useToast();
  const proposals = useJobProposals(job.id, true);
  const accept = useAcceptProposal(job.id);
  const [confirm, setConfirm] = useState<Proposal | null>(null);
  const list = useMemo(() => proposals.data?.pages.flatMap((p) => p.results) ?? [], [proposals.data]);
  if (proposals.isPending) return <Skeleton height={180} radius={18} />;
  if (proposals.isError) return <ErrorState error={proposals.error} onRetry={() => proposals.refetch()} />;
  if (list.length === 0) return <EmptyState icon={<UsersIcon />} title="Aucune proposition pour l'instant" text="Les développeurs intéressés vous enverront leur prix et leur délai." />;
  return (
    <>
      <div className={styles.list}>
        {list.map((p) => {
          const st = PROPOSAL_STATUS[p.status] ?? PROPOSAL_STATUS.submitted;
          const name = p.freelancer ? p.freelancer.display_name || p.freelancer.username : "";
          return (
            <article key={p.id} className={layout.panelCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Avatar name={name} src={p.freelancer?.avatar_url} size={40} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Link href={ROUTES.profile(p.freelancer!.username)} className={layout.personName}>
                    {name}
                  </Link>
                  <span className={layout.personMeta} style={{ display: "block" }}>
                    {formatMoney(p.bid_minor, p.currency)} · livraison en {p.delivery_days} jour{p.delivery_days > 1 ? "s" : ""} · {relativeTime(p.created_at)}
                  </span>
                </span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
              <p className={styles.letter} style={{ marginTop: 12 }}>
                {p.cover_letter}
              </p>
              {p.status === "submitted" && job.status === "open" && (
                <div className={styles.calloutActions} style={{ marginTop: 12 }}>
                  <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setConfirm(p)}>
                    Retenir cette proposition
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        busy={accept.isPending}
        onClose={() => setConfirm(null)}
        title="Retenir cette proposition ?"
        text="Un contrat est créé avec ce développeur, les autres propositions sont refusées et la mission est marquée comme pourvue."
        confirm="Retenir"
        onConfirm={() =>
          confirm &&
          accept.mutate(confirm.id, {
            onSuccess: () => {
              setConfirm(null);
              toast("Proposition retenue : le contrat est créé (onglet « Contrats »).", { tone: "success" });
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          })
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ManageJobPage({ id }: { id: string }) {
  const query = useJob(id);
  if (query.isPending) return <Skeleton height={300} radius={18} />;
  if (query.isError || !query.data.viewer?.can_manage) {
    const denied = !query.isError || (query.error instanceof ApiError && query.error.status === 404);
    return (
      <div className={layout.page}>
        {denied ? (
          <EmptyState icon={<LockIcon />} title="Accès réservé" text="Seuls les recruteurs de cette offre voient ses candidatures." />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }
  const job = query.data;
  const freelance = job.job_type === "freelance";
  return (
    <div className={layout.page}>
      <Link href={ROUTES.job(job.id)} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        Retour à l&apos;offre
      </Link>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <UsersIcon />
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className={layout.pageTitle}>{freelance ? "Propositions" : "Candidatures"}</h1>
            <p className={layout.pageLead}>{job.title}</p>
          </div>
        </div>
      </header>
      <div className={layout.layout}>
        <div className={layout.column}>{freelance ? <ProposalsList job={job} /> : <ApplicationsList job={job} />}</div>
        {!freelance && (
          <aside className={layout.stack} aria-label="Entretiens">
            <SlotsCard job={job} />
          </aside>
        )}
      </div>
    </div>
  );
}
