"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useContracts, useJobs, useMyApplications, useMyJobs, useMyProposals } from "@/features/jobs/hooks";
import type { JobFilters } from "@/features/jobs/api";
import { useReference } from "@/features/people/reference";
import { relativeTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { BriefcaseIcon, FileIcon, PlusIcon, SearchIcon, SparklesIcon, UsersIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Spinner } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import ui from "../ui/ui.module.css";
import { ContractsList } from "./Contracts";
import { JobCard, JobCardSkeleton } from "./JobCard";
import { JobFormDialog } from "./JobFormDialog";
import { APPLICATION_STATUS, JOB_TYPES, LEVELS, PROPOSAL_STATUS, REMOTE } from "./labels";
import styles from "./Jobs.module.css";

const TAB_IDS = ["offres", "candidatures", "annonces", "contrats"] as const;

function MoreButton({ query, label }: { query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }; label: string }) {
  if (!query.hasNextPage) return null;
  return (
    <div className={layout.more}>
      {query.isFetchingNextPage ? (
        <Spinner label="Chargement de la suite" />
      ) : (
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => query.fetchNextPage()}>
          {label}
        </button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className={styles.list} aria-busy="true" aria-label="Chargement">
      <JobCardSkeleton />
      <JobCardSkeleton />
      <JobCardSkeleton />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Offres                                                              */
/* ------------------------------------------------------------------ */

function OffersTab({ onPublish }: { onPublish: () => void }) {
  const [filters, setFilters] = useState<JobFilters>({});
  const countries = useReference("countries");
  const jobs = useJobs(filters);
  const list = useMemo(() => jobs.data?.pages.flatMap((p) => p.results) ?? [], [jobs.data]);
  const set = (key: keyof JobFilters, value: string) => setFilters((f) => ({ ...f, [key]: value || undefined }));
  const filtered = Object.values(filters).some(Boolean);
  const african = (countries.data ?? []).filter((c) => c.is_african);

  return (
    <>
      <div className={layout.toolbar}>
        <div className={layout.searchBox}>
          <SearchIcon />
          <input
            className={ui.input}
            type="search"
            placeholder="Intitulé : développeur Django, data analyst…"
            value={filters.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
            aria-label="Rechercher une offre"
          />
        </div>
      </div>
      <div className={styles.filters} role="group" aria-label="Filtres">
        <select className={ui.select} value={filters.type ?? ""} onChange={(e) => set("type", e.target.value)} aria-label="Type d'offre">
          <option value="">Tous les types</option>
          {Object.entries(JOB_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select className={ui.select} value={filters.remote ?? ""} onChange={(e) => set("remote", e.target.value)} aria-label="Lieu de travail">
          <option value="">Sur site ou à distance</option>
          {Object.entries(REMOTE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select className={ui.select} value={filters.level ?? ""} onChange={(e) => set("level", e.target.value)} aria-label="Niveau">
          <option value="">Tous niveaux</option>
          {Object.entries(LEVELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {african.length > 0 && (
          <select className={ui.select} value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)} aria-label="Pays">
            <option value="">Tous les pays</option>
            {african.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {filtered && (
          <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => setFilters({})}>
            Effacer les filtres
          </button>
        )}
      </div>
      {jobs.isPending ? (
        <Loading />
      ) : jobs.isError && list.length === 0 ? (
        <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon />}
          title={filtered ? "Aucune offre ne correspond" : "Aucune offre ouverte pour l'instant"}
          text={filtered ? "Élargissez la recherche ou retirez un filtre." : "Les offres d'emploi, de stage et les missions freelance apparaîtront ici dès leur publication."}
          actions={
            <button type="button" className={cx(ui.button, ui.primary)} onClick={onPublish}>
              <PlusIcon />
              Publier une offre
            </button>
          }
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          <MoreButton query={jobs} label="Afficher plus d'offres" />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mes candidatures et propositions                                    */
/* ------------------------------------------------------------------ */

function ApplicationsTab({ goOffers }: { goOffers: () => void }) {
  const apps = useMyApplications();
  const proposals = useMyProposals();
  const list = useMemo(() => apps.data?.pages.flatMap((p) => p.results) ?? [], [apps.data]);
  if (apps.isPending || proposals.isPending) return <Loading />;
  if (apps.isError) return <ErrorState error={apps.error} onRetry={() => apps.refetch()} />;
  const props = proposals.data ?? [];
  if (list.length === 0 && props.length === 0) {
    return (
      <EmptyState
        icon={<FileIcon />}
        title="Aucune candidature pour l'instant"
        text="Vos candidatures et vos propositions de mission apparaîtront ici, avec leur avancement."
        actions={
          <button type="button" className={cx(ui.button, ui.secondary)} onClick={goOffers}>
            <SparklesIcon />
            Voir les offres
          </button>
        }
      />
    );
  }
  return (
    <>
      {list.length > 0 && (
        <section aria-labelledby="mes-candidatures">
          <h2 id="mes-candidatures" className={layout.sectionTitle} style={{ marginBottom: 10 }}>
            Candidatures
          </h2>
          <ul className={layout.people}>
            {list.map((a) => {
              const status = APPLICATION_STATUS[a.status];
              const org = a.job.company?.name;
              return (
                <li key={a.id}>
                  <Link href={ROUTES.job(a.job.id)} className={styles.applicant} style={{ textDecoration: "none" }}>
                    <Avatar name={org ?? a.job.title} src={a.job.company?.logo_url} size={40} />
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.applicantName}>{a.job.title}</span>
                      <span className={styles.applicantMeta}>
                        {org ? `${org} · ` : ""}envoyée {relativeTime(a.created_at)}
                      </span>
                    </span>
                    <Pill tone={status.tone} dot>
                      {status.label}
                    </Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
          <MoreButton query={apps} label="Afficher plus" />
        </section>
      )}
      {props.length > 0 && (
        <section aria-labelledby="mes-propositions">
          <h2 id="mes-propositions" className={layout.sectionTitle} style={{ marginBottom: 10 }}>
            Propositions de mission
          </h2>
          <ul className={layout.people}>
            {props.map((p) => {
              const status = PROPOSAL_STATUS[p.status] ?? PROPOSAL_STATUS.submitted;
              return (
                <li key={p.id}>
                  <Link href={ROUTES.job(p.job!.id)} className={styles.applicant} style={{ textDecoration: "none" }}>
                    <Avatar name={p.job!.title} size={40} />
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.applicantName}>{p.job!.title}</span>
                      <span className={styles.applicantMeta}>
                        {formatMoney(p.bid_minor, p.currency)} · {p.delivery_days} jours · {relativeTime(p.created_at)}
                      </span>
                    </span>
                    <Pill tone={status.tone} dot>
                      {status.label}
                    </Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mes annonces (recruteur ou client)                                  */
/* ------------------------------------------------------------------ */

function PostingsTab({ query, onPublish }: { query: ReturnType<typeof useMyJobs>; onPublish: () => void }) {
  const list = useMemo(() => query.data?.pages.flatMap((p) => p.results) ?? [], [query.data]);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon />}
        title="Vous n'avez publié aucune offre"
        text="Recrutez pour votre entreprise ou confiez une mission freelance à un développeur de la communauté."
        actions={
          <button type="button" className={cx(ui.button, ui.primary)} onClick={onPublish}>
            <PlusIcon />
            Publier une offre
          </button>
        }
      />
    );
  }
  return (
    <>
      <div className={styles.list}>
        {list.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            footer={
              job.counts && (
                <span className={styles.counts}>
                  {job.job_type === "freelance" ? (
                    <span>
                      <strong>{job.counts.proposals}</strong> proposition{job.counts.proposals > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <>
                      <span>
                        <strong>{job.counts.applications}</strong> candidature{job.counts.applications > 1 ? "s" : ""}
                      </span>
                      {job.counts.new_applications > 0 && <span data-new="">{job.counts.new_applications} à examiner</span>}
                    </>
                  )}
                </span>
              )
            }
          />
        ))}
      </div>
      <MoreButton query={query} label="Afficher plus" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function JobsPage() {
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [publishing, setPublishing] = useState(false);
  const mine = useMyJobs();
  const contracts = useContracts();
  const toReview = mine.data?.pages.reduce((n, p) => n + p.results.reduce((m, j) => m + (j.counts?.new_applications ?? 0), 0), 0);
  const hasContracts = Boolean(contracts.data?.pages[0]?.results.length);

  const tabs = [
    { id: "offres" as const, label: "Offres", Icon: SparklesIcon },
    { id: "candidatures" as const, label: "Mes candidatures", Icon: FileIcon },
    { id: "annonces" as const, label: "Mes annonces", Icon: UsersIcon, count: toReview || undefined },
    ...(hasContracts ? [{ id: "contrats" as const, label: "Contrats", Icon: BriefcaseIcon }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "offres";

  return (
    <div className={layout.page}>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <BriefcaseIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Opportunités</h1>
            <p className={layout.pageLead}>Emplois, stages et missions freelance pour les développeurs africains.</p>
          </div>
        </div>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setPublishing(true)}>
          <PlusIcon />
          Publier une offre
        </button>
      </header>

      <Tabs idPrefix="opportunites" label="Opportunités" value={active} onChange={setTab} items={tabs} />
      <TabPanel idPrefix="opportunites" id={active} className={layout.stack}>
        {active === "offres" && <OffersTab onPublish={() => setPublishing(true)} />}
        {active === "candidatures" && <ApplicationsTab goOffers={() => setTab("offres")} />}
        {active === "annonces" && <PostingsTab query={mine} onPublish={() => setPublishing(true)} />}
        {active === "contrats" && <ContractsList />}
      </TabPanel>

      <JobFormDialog open={publishing} onClose={() => setPublishing(false)} />
    </div>
  );
}
