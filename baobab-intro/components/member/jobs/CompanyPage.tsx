"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCompany, useCompanyMembers, useCompanyTeam, useJobs } from "@/features/jobs/hooks";
import type { Company, CompanyRole } from "@/features/jobs/types";
import type { UserBrief } from "@/features/social/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { AudiencePicker } from "../composer/AudiencePicker";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { EntityHeader, EntityHeaderSkeleton } from "../ui/EntityHeader";
import { Field } from "../ui/Field";
import { ArrowLeftIcon, BriefcaseIcon, ExternalIcon, GlobeIcon, MapPinIcon, MoreIcon, PenIcon, PlusIcon, ProjectIcon, TrashIcon, UsersIcon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { CompanyFormDialog } from "./CompanyFormDialog";
import { JobCard, JobCardSkeleton } from "./JobCard";
import { JobFormDialog } from "./JobFormDialog";
import { COMPANY_ROLES, RECRUITER_ROLES } from "./labels";
import styles from "./Jobs.module.css";

const TAB_IDS = ["offres", "a-propos", "equipe"] as const;
const MANAGERS: CompanyRole[] = ["owner", "admin"];

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function OpenJobs({ company, canPost, onPost }: { company: Company; canPost: boolean; onPost: () => void }) {
  const jobs = useJobs({ company: company.slug });
  const list = useMemo(() => jobs.data?.pages.flatMap((p) => p.results) ?? [], [jobs.data]);
  if (jobs.isPending) return <JobCardSkeleton />;
  if (jobs.isError) return <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />;
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<BriefcaseIcon />}
        title="Aucune offre ouverte"
        text={canPost ? "Publiez une offre au nom de l'entreprise : elle apparaîtra ici et dans Opportunités." : `${company.name} ne recrute pas pour le moment.`}
        actions={
          canPost && (
            <button type="button" className={cx(ui.button, ui.primary)} onClick={onPost}>
              <PlusIcon />
              Publier une offre
            </button>
          )
        }
      />
    );
  }
  return (
    <div className={styles.list}>
      {list.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}

function About({ company }: { company: Company }) {
  const empty = !company.description && company.services.length === 0 && company.projects.length === 0;
  if (empty) return <EmptyState icon={<BriefcaseIcon />} title="Présentation à venir" text="L'entreprise n'a pas encore décrit ses activités." />;
  return (
    <>
      {company.description && (
        <section className={layout.panelCard}>
          <h2 className={styles.sectionHeading}>Présentation</h2>
          <p className={styles.body}>{company.description}</p>
        </section>
      )}
      {company.services.length > 0 && (
        <section className={layout.panelCard}>
          <h2 className={styles.sectionHeading}>Services</h2>
          <ul className={layout.facts} style={{ padding: 0, listStyle: "none" }}>
            {company.services.map((s) => (
              <li key={s.title}>
                <strong style={{ color: "var(--bb-brown-950)" }}>{s.title}</strong>
                {s.starting_price_minor != null && s.currency && <span className={ui.hint}> · à partir de {formatMoney(s.starting_price_minor, s.currency)}</span>}
                {s.description && <p className={ui.hint} style={{ margin: "2px 0 0" }}>{s.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {company.projects.length > 0 && (
        <section className={layout.panelCard}>
          <h2 className={styles.sectionHeading}>Projets</h2>
          <ul className={layout.facts} style={{ padding: 0, listStyle: "none" }}>
            {company.projects.map((p) => (
              <li key={p.title} className={layout.fact}>
                <ProjectIcon aria-hidden="true" />
                <strong style={{ color: "var(--bb-brown-950)" }}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer noopener" style={{ color: "inherit" }}>
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </strong>
                <span className={ui.hint} style={{ margin: 0 }}>
                  {p.description}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AddMemberDialog({ company, open, onClose }: { company: Company; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const team = useCompanyTeam(company.slug);
  const [people, setPeople] = useState<UserBrief[]>([]);
  const [role, setRole] = useState<CompanyRole>("recruiter");
  const [title, setTitle] = useState("");
  const assignable = (Object.keys(COMPANY_ROLES) as CompanyRole[]).filter((r) => r !== "owner" && (company.my_role === "owner" || !MANAGERS.includes(r)));
  const submit = async () => {
    for (const person of people) {
      try {
        await team.add.mutateAsync({ username: person.username, role, title: title.trim() });
      } catch (error) {
        toast(`${person.display_name || person.username} : ${describeError(error)}`, { tone: "error" });
        return;
      }
    }
    toast(people.length > 1 ? "Membres ajoutés." : "Membre ajouté.", { tone: "success" });
    setPeople([]);
    setTitle("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={team.add.isPending}
      title="Ajouter à l'équipe"
      footer={
        <button type="button" className={cx(ui.button, ui.primary)} onClick={submit} disabled={people.length === 0 || team.add.isPending}>
          Ajouter
        </button>
      }
    >
      <div className={layout.form}>
        <AudiencePicker value={people} onChange={setPeople} />
        <Field id="member-role" label="Rôle" hint="Recruteur : publie les offres et gère les candidatures. Éditeur : modifie la page.">
          <select id="member-role" className={ui.select} value={role} onChange={(e) => setRole(e.target.value as CompanyRole)}>
            {assignable.map((r) => (
              <option key={r} value={r}>
                {COMPANY_ROLES[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="member-title" label="Fonction affichée" optional>
          <input id="member-title" className={ui.input} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CTO, Lead dev…" />
        </Field>
      </div>
    </Dialog>
  );
}

function Team({ company }: { company: Company }) {
  const toast = useToast();
  const members = useCompanyMembers(company.slug);
  const team = useCompanyTeam(company.slug);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const manager = company.my_role ? MANAGERS.includes(company.my_role) : false;
  if (members.isPending) return <Skeleton height={140} radius={18} />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => members.refetch()} />;
  return (
    <>
      {manager && (
        <button type="button" className={cx(ui.button, ui.secondary)} style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>
          <PlusIcon />
          Ajouter un membre
        </button>
      )}
      {members.data.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title="Équipe non publiée" />
      ) : (
        <ul className={layout.people} aria-label="Équipe">
          {members.data.map((m) => (
            <li key={m.username} className={layout.person}>
              <Avatar name={m.display_name || m.username} src={m.avatar_url} size={40} />
              <span className={layout.personText}>
                <Link href={ROUTES.profile(m.username)} className={layout.personName}>
                  {m.display_name || m.username}
                </Link>
                <span className={layout.personMeta}>{m.title || `@${m.username}`}</span>
              </span>
              <span className={layout.personActions}>
                <Pill tone={RECRUITER_ROLES.includes(m.role) ? "brown" : "neutral"}>{COMPANY_ROLES[m.role]}</Pill>
                {manager && m.role !== "owner" && (
                  <Menu label={`Gérer ${m.display_name || m.username}`} items={[{ label: "Retirer de l'équipe", icon: <TrashIcon />, tone: "danger", onSelect: () => setRemoving(m.username) }]} trigger={<MoreIcon />} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <AddMemberDialog company={company} open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={removing !== null}
        busy={team.remove.isPending}
        onClose={() => setRemoving(null)}
        title="Retirer ce membre ?"
        text="Il ou elle perd l'accès aux offres et aux candidatures de l'entreprise."
        confirm="Retirer"
        onConfirm={() =>
          removing &&
          team.remove.mutate(removing, {
            onSuccess: () => {
              setRemoving(null);
              toast("Membre retiré.", { tone: "success" });
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          })
        }
      />
    </>
  );
}

export function CompanyPage({ slug }: { slug: string }) {
  const query = useCompany(slug);
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);

  if (query.isPending) return <EntityHeaderSkeleton />;
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={ROUTES.jobs} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Opportunités
        </Link>
        {gone ? <EmptyState icon={<BriefcaseIcon />} title="Entreprise introuvable" text="Cette page n'existe pas ou a été suspendue." /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }
  const c = query.data;
  const canEdit = c.my_role ? ["owner", "admin", "editor"].includes(c.my_role) : false;
  const canPost = c.my_role ? RECRUITER_ROLES.includes(c.my_role) : false;
  const place = [c.city, c.country_name].filter(Boolean).join(", ");

  return (
    <div className={layout.page}>
      <EntityHeader
        name={c.name}
        coverUrl={c.cover_url}
        avatarUrl={c.logo_url}
        verified={c.verified}
        tagline={c.tagline || undefined}
        actions={
          <>
            {canPost && (
              <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setPosting(true)}>
                <PlusIcon />
                Publier une offre
              </button>
            )}
            {canEdit && (
              <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setEditing(true)}>
                <PenIcon />
                Modifier
              </button>
            )}
          </>
        }
        meta={
          <>
            {c.industry && (
              <li>
                <BriefcaseIcon aria-hidden="true" />
                {c.industry}
              </li>
            )}
            {c.size_range && (
              <li>
                <UsersIcon aria-hidden="true" />
                {c.size_range} personnes
              </li>
            )}
            {place && (
              <li>
                <MapPinIcon aria-hidden="true" />
                {place}
              </li>
            )}
            {c.website && (
              <li>
                <GlobeIcon aria-hidden="true" />
                <a href={c.website} target="_blank" rel="noreferrer noopener" style={{ color: "var(--bb-brown-700)", fontWeight: 650 }}>
                  {host(c.website)}
                </a>
              </li>
            )}
            {c.links.map((l) => (
              <li key={l.url}>
                <ExternalIcon aria-hidden="true" />
                <a href={l.url} target="_blank" rel="noreferrer noopener" style={{ color: "var(--bb-brown-700)" }}>
                  {l.provider}
                </a>
              </li>
            ))}
          </>
        }
      />
      <Tabs
        idPrefix="entreprise"
        label="Sections de l'entreprise"
        value={tab}
        onChange={setTab}
        items={[
          { id: "offres", label: "Offres", Icon: BriefcaseIcon },
          { id: "a-propos", label: "À propos", Icon: ProjectIcon },
          { id: "equipe", label: "Équipe", Icon: UsersIcon },
        ]}
      />
      <TabPanel idPrefix="entreprise" id={tab} className={layout.stack}>
        {tab === "offres" && <OpenJobs company={c} canPost={canPost} onPost={() => setPosting(true)} />}
        {tab === "a-propos" && <About company={c} />}
        {tab === "equipe" && <Team company={c} />}
      </TabPanel>
      {canEdit && <CompanyFormDialog open={editing} onClose={() => setEditing(false)} company={c} />}
      {canPost && <JobFormDialog open={posting} onClose={() => setPosting(false)} company={c.slug} />}
    </div>
  );
}
