"use client";

import { useState } from "react";
import { useApplication, useBook, useRespondOffer, useSlots, useTransition } from "@/features/jobs/hooks";
import type { Application, ApplicationStatus, Interview, Slot } from "@/features/jobs/types";
import { describeError } from "@/lib/api/errors";
import { relativeTime } from "@/lib/format";
import { formatMoney, PERIOD_LABELS } from "@/lib/money";
import { ConfirmDialog } from "../post/PostDialogs";
import { cx } from "../ui/cx";
import { CalendarIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { APPLICATION_STATUS, INTERVIEW_MODES, PIPELINE } from "./labels";
import styles from "./Jobs.module.css";

const WHEN = new Intl.DateTimeFormat("fr", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const TIME = new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long", year: "numeric" });

export function slotLabel(slot: Pick<Slot, "starts_at" | "ends_at">) {
  return `${WHEN.format(new Date(slot.starts_at))} – ${TIME.format(new Date(slot.ends_at))}`;
}

/** Frise des étapes : faites, en cours, à venir. Une candidature close (refusée, retirée) n'a pas d'étape « en cours ». */
export function Steps({ status, history }: { status: ApplicationStatus; history: Application["history"] }) {
  const reached = new Set(history.map((h) => h.to));
  const index = PIPELINE.indexOf(status);
  return (
    <ol className={styles.steps} aria-label="Étapes de la candidature">
      {PIPELINE.map((step, i) => {
        const state = i < index || (index === -1 && reached.has(step)) ? "done" : i === index ? "current" : "todo";
        return (
          <li key={step} className={styles.step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span>{APPLICATION_STATUS[step].label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function History({ history }: { history: Application["history"] }) {
  return (
    <ol className={styles.timeline} aria-label="Historique">
      {[...history].reverse().map((h, i) => (
        <li key={`${h.at}-${i}`} className={styles.event}>
          <span>
            <strong>{APPLICATION_STATUS[h.to]?.label ?? h.to}</strong>
            {h.note && ` — ${h.note}`}
            <small>{relativeTime(h.at)}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function InterviewInfo({ interview }: { interview: Interview }) {
  return (
    <div className={styles.callout}>
      <p>
        <CalendarIcon width={18} height={18} aria-hidden="true" style={{ verticalAlign: "-4px", marginRight: 6 }} />
        Entretien <strong>{interview.starts_at ? WHEN.format(new Date(interview.starts_at)) : "à planifier"}</strong> · {INTERVIEW_MODES[interview.mode] ?? interview.mode}
      </p>
      {interview.location && (
        <p>
          {/^https:\/\//.test(interview.location) ? (
            <a href={interview.location} target="_blank" rel="noreferrer noopener">
              Rejoindre la visio
            </a>
          ) : (
            interview.location
          )}
        </p>
      )}
    </div>
  );
}

/** Choix d'un créneau d'entretien par le candidat présélectionné. */
function BookSlot({ jobId, application }: { jobId: string; application: Application }) {
  const toast = useToast();
  const slots = useSlots(jobId, true);
  const book = useBook(jobId, application.id);
  const [chosen, setChosen] = useState<string | null>(null);
  const [mode, setMode] = useState("video");
  if (slots.isPending) return <Skeleton height={60} radius={12} />;
  const free = (slots.data ?? []).filter((s) => !s.booked);
  if (free.length === 0) {
    return (
      <div className={styles.callout}>
        <p>Vous êtes présélectionné(e). Le recruteur n&apos;a pas encore proposé de créneau d&apos;entretien : vous serez prévenu(e).</p>
      </div>
    );
  }
  return (
    <div className={styles.callout}>
      <p>
        <strong>Choisissez un créneau d&apos;entretien.</strong>
      </p>
      <ul className={styles.slots}>
        {free.map((slot) => (
          <li key={slot.id}>
            <button type="button" className={styles.slot} aria-pressed={chosen === slot.id} onClick={() => setChosen(slot.id)}>
              {WHEN.format(new Date(slot.starts_at))}
              <small>jusqu&apos;à {TIME.format(new Date(slot.ends_at))}</small>
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label="Format">
        {Object.entries(INTERVIEW_MODES).map(([value, label]) => (
          <button key={value} type="button" className={ui.chip} aria-pressed={mode === value} onClick={() => setMode(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.calloutActions}>
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          disabled={!chosen || book.isPending}
          onClick={() =>
            book.mutate(
              { slot: chosen!, mode, location: "" },
              { onSuccess: () => toast("Entretien réservé.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) },
            )
          }
        >
          Réserver ce créneau
        </button>
      </div>
    </div>
  );
}

function OfferCallout({ jobId, application }: { jobId: string; application: Application }) {
  const toast = useToast();
  const respond = useRespondOffer(jobId, application.id);
  const [confirm, setConfirm] = useState(false);
  const offer = application.offer!;
  const period = PERIOD_LABELS[offer.period];
  const answer = (accept: boolean) =>
    respond.mutate(
      { id: offer.id, accept },
      {
        onSuccess: () => {
          setConfirm(false);
          toast(accept ? "Offre acceptée : félicitations !" : "Offre refusée.", { tone: "success" });
        },
        onError: (e) => toast(describeError(e), { tone: "error" }),
      },
    );
  if (offer.status !== "sent") {
    return (
      <div className={styles.callout} data-tone={offer.status === "accepted" ? "green" : undefined}>
        <p>
          Offre de <strong>{formatMoney(offer.amount_minor, offer.currency)}</strong>
          {period && ` par ${period}`} — {offer.status === "accepted" ? "acceptée" : offer.status === "declined" ? "refusée" : "retirée"}.
        </p>
      </div>
    );
  }
  return (
    <div className={styles.callout} data-tone="green">
      <p>
        <strong>Vous avez reçu une offre</strong> : {formatMoney(offer.amount_minor, offer.currency)}
        {period && ` par ${period}`}
        {offer.start_date && `, début le ${DAY.format(new Date(offer.start_date))}`}.
      </p>
      {offer.expires_at && <p>Réponse attendue avant le {DAY.format(new Date(offer.expires_at))}.</p>}
      <div className={styles.calloutActions}>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={() => answer(true)} disabled={respond.isPending}>
          Accepter l&apos;offre
        </button>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setConfirm(true)} disabled={respond.isPending}>
          Refuser
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        busy={respond.isPending}
        onClose={() => setConfirm(false)}
        title="Refuser cette offre ?"
        text="La candidature sera close. Ce choix est définitif."
        confirm="Refuser l'offre"
        onConfirm={() => answer(false)}
      />
    </div>
  );
}

/** Suivi de MA candidature sur la page de l'offre : étapes, entretien, offre, historique, retrait. */
export function ApplicationTracker({ jobId, applicationId }: { jobId: string; applicationId: string }) {
  const toast = useToast();
  const query = useApplication(applicationId);
  const transition = useTransition(jobId);
  const [withdrawing, setWithdrawing] = useState(false);
  if (query.isPending) return <Skeleton height={140} radius={18} />;
  if (query.isError) return null;
  const a = query.data;
  const status = APPLICATION_STATUS[a.status];
  const open = !["hired", "rejected", "withdrawn"].includes(a.status);
  const interview = a.interviews.find((i) => i.status === "scheduled");

  return (
    <section className={layout.panelCard} aria-labelledby="ma-candidature">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 id="ma-candidature" className={styles.sectionHeading} style={{ margin: 0 }}>
          Ma candidature
        </h2>
        <Pill tone={status.tone} dot>
          {status.label}
        </Pill>
      </div>
      <div className={layout.stack} style={{ gap: 14 }}>
        <Steps status={a.status} history={a.history} />
        <p className={ui.hint} style={{ margin: 0 }}>
          {status.hint}
        </p>
        {a.status === "shortlisted" && !interview && <BookSlot jobId={jobId} application={a} />}
        {interview && <InterviewInfo interview={interview} />}
        {a.offer && <OfferCallout jobId={jobId} application={a} />}
        <details>
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 650, color: "var(--bb-brown-800)" }}>Historique et pièces envoyées</summary>
          <div className={layout.stack} style={{ gap: 12, marginTop: 12 }}>
            <History history={a.history} />
            {a.cover_letter && <p className={styles.letter}>{a.cover_letter}</p>}
            {a.cv_url && (
              <a className={cx(ui.button, ui.secondary, ui.small)} href={a.cv_url} target="_blank" rel="noreferrer noopener" style={{ alignSelf: "flex-start" }}>
                Voir le CV envoyé
              </a>
            )}
          </div>
        </details>
        {open && a.status !== "offer" && (
          <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => setWithdrawing(true)}>
            Retirer ma candidature
          </button>
        )}
      </div>
      <ConfirmDialog
        open={withdrawing}
        busy={transition.isPending}
        onClose={() => setWithdrawing(false)}
        title="Retirer votre candidature ?"
        text="Le recruteur verra qu'elle a été retirée. Vous ne pourrez pas postuler une seconde fois à cette offre."
        confirm="Retirer"
        onConfirm={() =>
          transition.mutate(
            { id: a.id, to: "withdrawn" },
            {
              onSuccess: () => {
                setWithdrawing(false);
                toast("Candidature retirée.", { tone: "success" });
              },
              onError: (e) => toast(describeError(e), { tone: "error" }),
            },
          )
        }
      />
    </section>
  );
}
