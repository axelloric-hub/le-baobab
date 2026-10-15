"use client";

import Link from "next/link";
import type { Job } from "@/features/jobs/types";
import { relativeTime } from "@/lib/format";
import { formatSalary } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { BriefcaseIcon, ClockIcon, GlobeIcon, MapPinIcon } from "../ui/icons";
import { Pill } from "../ui/Pill";
import { Skeleton } from "../ui/States";
import { APPLICATION_STATUS, JOB_STATUS, JOB_TYPES, LEVELS, PROPOSAL_STATUS, REMOTE } from "./labels";
import styles from "./Jobs.module.css";

/** « Douala, Cameroun » ; « Télétravail » si l'offre est entièrement à distance sans lieu. */
export function jobPlace(job: Pick<Job, "city" | "country_name" | "remote_policy">) {
  return [job.city, job.country_name].filter(Boolean).join(", ");
}

/** Organisation qui publie : l'entreprise, ou la personne pour une mission freelance individuelle. */
export function jobOrg(job: Job) {
  return job.company
    ? { name: job.company.name, logo: job.company.logo_url }
    : { name: job.posted_by.display_name || job.posted_by.username, logo: job.posted_by.avatar_url };
}

/** État du membre vis-à-vis de l'offre, en une pastille (candidature, proposition, gestion). */
export function ViewerPill({ job }: { job: Job }) {
  const v = job.viewer;
  if (!v) return null;
  if (v.can_manage) {
    const status = JOB_STATUS[job.status];
    return <Pill tone={status.tone}>{status.label}</Pill>;
  }
  if (v.application) {
    const status = APPLICATION_STATUS[v.application.status];
    return (
      <Pill tone={status.tone} dot>
        {status.label}
      </Pill>
    );
  }
  if (v.proposal) {
    const status = PROPOSAL_STATUS[v.proposal.status] ?? PROPOSAL_STATUS.submitted;
    return (
      <Pill tone={status.tone} dot>
        Proposition {status.label.toLowerCase()}
      </Pill>
    );
  }
  return null;
}

export function JobTags({ job }: { job: Job }) {
  const place = jobPlace(job);
  const salary = formatSalary(job.salary);
  return (
    <ul className={styles.tags}>
      <li className={styles.tag}>
        <BriefcaseIcon aria-hidden="true" />
        {JOB_TYPES[job.job_type]}
      </li>
      <li className={styles.tag}>
        <GlobeIcon aria-hidden="true" />
        {REMOTE[job.remote_policy]}
      </li>
      {place && (
        <li className={styles.tag}>
          <MapPinIcon aria-hidden="true" />
          {place}
        </li>
      )}
      <li className={styles.tag}>{LEVELS[job.experience_level]}</li>
      {salary && (
        <li className={styles.tag} data-tone="money">
          {salary}
        </li>
      )}
    </ul>
  );
}

export function JobCard({ job, href, footer }: { job: Job; href?: string; footer?: React.ReactNode }) {
  const org = jobOrg(job);
  const required = job.skills.filter((s) => s.required);
  const shown = (required.length ? required : job.skills).slice(0, 5);
  return (
    <article className={styles.job}>
      <span className={styles.jobLogo}>
        <Avatar name={org.name} src={org.logo} size={48} />
      </span>
      <div className={styles.jobMain}>
        <div className={styles.jobTop}>
          <div style={{ minWidth: 0 }}>
            <h3 className={styles.jobTitle}>
              <Link href={href ?? ROUTES.job(job.id)} className={styles.jobLink}>
                {job.title}
              </Link>
            </h3>
            <p className={styles.jobOrg}>
              <strong>{org.name}</strong>
              {!job.company && " · mission individuelle"}
            </p>
          </div>
          <ViewerPill job={job} />
        </div>
        <JobTags job={job} />
        {shown.length > 0 && (
          <ul className={styles.skills} aria-label="Compétences">
            {shown.map((s) => (
              <li key={s.slug} className={styles.skill}>
                {s.name}
              </li>
            ))}
            {job.skills.length > shown.length && <li className={styles.skill} data-optional="">+{job.skills.length - shown.length}</li>}
          </ul>
        )}
        <div className={styles.jobFoot}>
          <span>
            {job.published_at ? `Publiée ${relativeTime(job.published_at)}` : `Créée ${relativeTime(job.created_at)}`}
            {job.deadline && (
              <>
                {" · "}
                <ClockIcon width={13} height={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> jusqu&apos;au{" "}
                {new Date(job.deadline).toLocaleDateString("fr", { day: "numeric", month: "long" })}
              </>
            )}
          </span>
          {footer}
        </div>
      </div>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className={styles.job} aria-hidden="true">
      <Skeleton width={48} height={48} radius={12} />
      <div className={styles.jobMain}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="35%" height={13} />
        <Skeleton width="80%" height={22} radius={8} />
      </div>
    </div>
  );
}
