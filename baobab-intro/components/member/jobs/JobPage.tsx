"use client";

import Link from "next/link";
import { useState } from "react";
import { useJob, useJobStatus } from "@/features/jobs/hooks";
import type { Job } from "@/features/jobs/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { relativeTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { ArrowLeftIcon, BriefcaseIcon, ChevronRightIcon, CopyIcon, LockIcon, MoreIcon, PenIcon, SendIcon, UsersIcon, VerifiedIcon } from "../ui/icons";
import { Menu, type MenuEntry } from "../ui/Menu";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { ApplicationTracker } from "./ApplicationTracker";
import { ApplyDialog, ProposalDialog } from "./ApplyDialogs";
import { JobTags, jobOrg } from "./JobCard";
import { JobFormDialog } from "./JobFormDialog";
import { CONTRACTS, JOB_STATUS, PROPOSAL_STATUS } from "./labels";
import styles from "./Jobs.module.css";

const DAY = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long", year: "numeric" });

function ManageCard({ job, onEdit }: { job: Job; onEdit: () => void }) {
  const toast = useToast();
  const status = useJobStatus(job.id);
  const [confirm, setConfirm] = useState<null | "close" | "fill">(null);
  const st = JOB_STATUS[job.status];
  const editable = ["draft", "open", "paused"].includes(job.status);
  const run = (action: "publish" | "close" | "fill") =>
    status.mutate(action, {
      onSuccess: () => {
        setConfirm(null);
        toast(action === "publish" ? "Offre publiée." : action === "fill" ? "Offre marquée comme pourvue." : "Offre fermée.", { tone: "success" });
      },
      onError: (e) => {
        setConfirm(null);
        toast(describeError(e), { tone: "error" });
      },
    });
  const menu: MenuEntry[] = [
    ...(editable ? [{ label: "Modifier l'offre", icon: <PenIcon />, onSelect: onEdit }] : []),
    ...(job.status === "open"
      ? [
          { label: "Marquer comme pourvue", icon: <UsersIcon />, onSelect: () => setConfirm("fill") },
          { label: "Fermer l'offre", icon: <LockIcon />, tone: "danger" as const, onSelect: () => setConfirm("close") },
        ]
      : []),
  ];
  return (
    <section className={layout.panelCard} aria-labelledby="gerer-offre">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h2 id="gerer-offre" className={layout.panelTitle} style={{ margin: 0 }}>
          <BriefcaseIcon aria-hidden="true" />
          Votre annonce
        </h2>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <div className={layout.stack} style={{ gap: 10, marginTop: 14 }}>
        {job.status === "draft" && <p className={ui.hint} style={{ margin: 0 }}>Brouillon : personne d&apos;autre que vous ne voit cette offre.</p>}
        {(job.status === "draft" || job.status === "paused") && (
          <button type="button" className={cx(ui.button, ui.primary, ui.block)} onClick={() => run("publish")} disabled={status.isPending}>
            <SendIcon />
            Publier l&apos;offre
          </button>
        )}
        {job.status !== "draft" && (
          <Link href={ROUTES.jobManage(job.id)} className={cx(ui.button, job.status === "open" ? ui.primary : ui.secondary, ui.block)}>
            <UsersIcon />
            {job.job_type === "freelance" ? "Voir les propositions" : "Voir les candidatures"}
          </Link>
        )}
        {menu.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Menu label="Gérer l'annonce" items={menu} trigger={<MoreIcon />} />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        busy={status.isPending}
        onClose={() => setConfirm(null)}
        title={confirm === "fill" ? "Le poste est pourvu ?" : "Fermer cette offre ?"}
        text="L'offre disparaît de la liste et n'accepte plus de candidatures. Les candidatures reçues restent consultables."
        confirm={confirm === "fill" ? "Marquer comme pourvue" : "Fermer l'offre"}
        onConfirm={() => confirm && run(confirm)}
      />
    </section>
  );
}

function CandidateCard({ job, onApply }: { job: Job; onApply: () => void }) {
  const v = job.viewer;
  const freelance = job.job_type === "freelance";
  if (v?.proposal) {
    const st = PROPOSAL_STATUS[v.proposal.status] ?? PROPOSAL_STATUS.submitted;
    return (
      <section className={layout.panelCard}>
        <p className={layout.panelTitle}>Votre proposition</p>
        <Pill tone={st.tone} dot>
          {st.label}
        </Pill>
        <p className={ui.hint}>Retrouvez toutes vos propositions dans « Mes candidatures ».</p>
      </section>
    );
  }
  if (v?.application) return null; // le suivi détaillé est affiché dans la colonne principale
  if (job.status !== "open") {
    return (
      <section className={layout.panelCard}>
        <p className={layout.panelTitle}>Offre {JOB_STATUS[job.status].label.toLowerCase()}</p>
        <p className={ui.hint} style={{ margin: 0 }}>
          Cette offre n&apos;accepte plus de {freelance ? "propositions" : "candidatures"}.
        </p>
      </section>
    );
  }
  return (
    <section className={cx(layout.panelCard, styles.wideOnly)}>
      <button type="button" className={cx(ui.button, ui.primary, ui.block)} onClick={onApply}>
        <SendIcon />
        {freelance ? "Envoyer une proposition" : "Postuler"}
      </button>
      <p className={ui.hint}>
        {freelance ? "Proposez votre prix et votre délai : le client choisit une proposition." : "Lettre de motivation, CV et projets de votre portfolio."}
      </p>
    </section>
  );
}

function OrgCard({ job }: { job: Job }) {
  if (job.company) {
    return (
      <Link href={ROUTES.company(job.company.slug)} className={cx(layout.panelCard)} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
        <Avatar name={job.company.name} src={job.company.logo_url} size={48} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--bb-brown-950)" }}>
            {job.company.name}
            {job.company.verified && <VerifiedIcon width={18} height={18} style={{ color: "var(--bb-blue-600)" }} />}
          </strong>
          <span className={ui.hint} style={{ display: "block", margin: 0 }}>
            Voir la page de l&apos;entreprise
          </span>
        </span>
        <ChevronRightIcon width={18} height={18} aria-hidden="true" />
      </Link>
    );
  }
  const p = job.posted_by;
  return (
    <Link href={ROUTES.profile(p.username)} className={layout.panelCard} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
      <Avatar name={p.display_name || p.username} src={p.avatar_url} size={48} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: "var(--bb-brown-950)" }}>{p.display_name || p.username}</strong>
        <span className={ui.hint} style={{ display: "block", margin: 0 }}>
          Client de la mission · voir le profil
        </span>
      </span>
      <ChevronRightIcon width={18} height={18} aria-hidden="true" />
    </Link>
  );
}

export function JobPage({ id }: { id: string }) {
  const query = useJob(id);
  const toast = useToast();
  const [applying, setApplying] = useState(false);
  const [editing, setEditing] = useState(false);

  if (query.isPending) {
    return (
      <div className={layout.page} aria-busy="true">
        <Skeleton height={220} radius={18} />
        <Skeleton height={300} radius={18} />
      </div>
    );
  }
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={ROUTES.jobs} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Toutes les offres
        </Link>
        {gone ? <EmptyState icon={<BriefcaseIcon />} title="Offre introuvable" text="Cette offre n'existe pas ou n'est plus publiée." /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }

  const job = query.data;
  const org = jobOrg(job);
  const manage = Boolean(job.viewer?.can_manage);
  const copyLink = () =>
    navigator.clipboard.writeText(`${window.location.origin}${ROUTES.job(job.id)}`).then(
      () => toast("Lien de l'offre copié.", { tone: "success" }),
      () => toast("Impossible de copier sur cet appareil.", { tone: "error" }),
    );

  return (
    <div className={layout.page}>
      <Link href={ROUTES.jobs} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        Opportunités
      </Link>
      <div className={layout.layout}>
        <div className={layout.column}>
          <section className={styles.hero}>
            <div className={styles.heroHead}>
              <span className={styles.jobLogo}>
                <Avatar name={org.name} src={org.logo} size={64} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 className={styles.heroTitle}>{job.title}</h1>
                <p className={styles.heroOrg}>
                  {job.company ? <Link href={ROUTES.company(job.company.slug)}>{job.company.name}</Link> : <Link href={ROUTES.profile(job.posted_by.username)}>{org.name}</Link>}
                  {" · "}
                  {CONTRACTS[job.contract_type]}
                </p>
              </div>
              <button type="button" className={ui.iconButton} onClick={copyLink} aria-label="Copier le lien de l'offre">
                <CopyIcon />
              </button>
            </div>
            <JobTags job={job} />
            <p className={ui.hint} style={{ margin: 0 }}>
              {job.published_at ? `Publiée ${relativeTime(job.published_at)}` : "Pas encore publiée"}
              {job.deadline && ` · candidatures jusqu'au ${DAY.format(new Date(job.deadline))}`}
            </p>
            {/* Petit écran : l'action principale reste visible sans descendre jusqu'à la colonne latérale. */}
            {!manage && job.status === "open" && !job.viewer?.application && !job.viewer?.proposal && (
              <div className={cx(styles.heroActions, styles.narrowOnly)}>
                <button type="button" className={cx(ui.button, ui.primary, ui.block)} onClick={() => setApplying(true)}>
                  <SendIcon />
                  {job.job_type === "freelance" ? "Envoyer une proposition" : "Postuler"}
                </button>
              </div>
            )}
          </section>

          {job.viewer?.application && <ApplicationTracker jobId={job.id} applicationId={job.viewer.application.id} />}

          <section className={layout.panelCard} aria-labelledby="offre-description">
            <h2 id="offre-description" className={styles.sectionHeading}>
              Description
            </h2>
            <p className={styles.body}>{job.description}</p>
          </section>

          {job.skills.length > 0 && (
            <section className={layout.panelCard} aria-labelledby="offre-competences">
              <h2 id="offre-competences" className={styles.sectionHeading}>
                Compétences
              </h2>
              <ul className={styles.skills}>
                {job.skills.map((s) => (
                  <li key={s.slug} className={styles.skill} data-optional={s.required ? undefined : ""} title={s.required ? "Indispensable" : "Appréciée"}>
                    {s.name}
                    {!s.required && " (un plus)"}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className={layout.stack} aria-label="Actions">
          {manage ? <ManageCard job={job} onEdit={() => setEditing(true)} /> : <CandidateCard job={job} onApply={() => setApplying(true)} />}
          <OrgCard job={job} />
        </aside>
      </div>

      {!manage && job.job_type !== "freelance" && <ApplyDialog job={job} open={applying} onClose={() => setApplying(false)} />}
      {!manage && job.job_type === "freelance" && <ProposalDialog job={job} open={applying} onClose={() => setApplying(false)} />}
      {manage && <JobFormDialog job={job} open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}
