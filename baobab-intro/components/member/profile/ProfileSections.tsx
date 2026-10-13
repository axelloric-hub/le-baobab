"use client";

import { useMemo, useState } from "react";
import { usePortfolioMutations } from "@/features/people/mutations";
import { LEVEL_COLORS, SKILL_LEVELS, useSkillNames } from "@/features/people/reference";
import type { Portfolio, Profile } from "@/features/people/types";
import { describeError } from "@/lib/api/errors";
import { ConfirmDialog } from "../post/PostDialogs";
import { cx } from "../ui/cx";
import { AwardIcon, CodeIcon, ExternalIcon, PlusIcon, ProjectIcon, RepoIcon, SparklesIcon, StarIcon, TimelineIcon, TrashIcon, UserIcon, VerifiedIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import type { AddKind } from "./PortfolioDialogs";
import styles from "./Profile.module.css";

const MONTH = new Intl.DateTimeFormat("fr", { month: "short", year: "numeric" });
const DAY = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long", year: "numeric" });
const month = (iso: string | null | undefined) => (iso ? MONTH.format(new Date(iso)) : "");

/** Couleurs des langages (repères visuels façon GitHub, dans la palette de la charte quand c'est possible). */
const LANG_COLORS: Record<string, string> = {
  python: "#2563eb",
  javascript: "#ca8a04",
  typescript: "#1f56d6",
  go: "#0891b2",
  rust: "#9a4a1f",
  java: "#b45309",
  kotlin: "#7c3aed",
  php: "#4f46e5",
  dart: "#0284c7",
  ruby: "#b91c1c",
};

function useRemove(username: string) {
  const toast = useToast();
  const { remove } = usePortfolioMutations(username);
  const [target, setTarget] = useState<null | { kind: string; id: string; label: string }>(null);
  const dialog = target && (
    <ConfirmDialog
      open
      busy={remove.isPending}
      onClose={() => setTarget(null)}
      title={`Supprimer « ${target.label} » ?`}
      text="Cette entrée disparaîtra de votre profil. Vous pourrez l'ajouter de nouveau plus tard."
      confirm="Supprimer"
      onConfirm={() =>
        remove.mutate(
          { kind: target.kind, id: target.id },
          {
            onSuccess: () => {
              setTarget(null);
              toast("Supprimé de votre profil.", { tone: "success" });
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          },
        )
      }
    />
  );
  return { ask: setTarget, dialog };
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={cx(ui.iconButton, styles.remove)} aria-label={`Supprimer ${label}`} onClick={onClick} style={{ width: 34, height: 34 }}>
      <TrashIcon />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={onClick}>
      <PlusIcon />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Projets et dépôts                                                   */
/* ------------------------------------------------------------------ */

export function ProjectsCard({
  portfolio,
  isMe,
  onAdd,
  limit,
  title = "Projets et dépôts",
}: {
  portfolio: Portfolio | undefined;
  isMe: boolean;
  onAdd: (kind: AddKind) => void;
  limit?: number;
  title?: string;
}) {
  const skillName = useSkillNames();
  const { ask, dialog } = useRemove(portfolio?.owner.username ?? "");
  const projects = portfolio?.projects ?? [];
  const repos = portfolio?.repositories ?? [];
  const featured = [...projects].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
  const items = [...featured.map((p) => ({ type: "project" as const, p })), ...repos.map((r) => ({ type: "repo" as const, r }))];
  const shown = limit ? items.slice(0, limit) : items;

  return (
    <section className={styles.card} aria-labelledby="profil-projets">
      <div className={styles.cardHead}>
        <h2 id="profil-projets" className={styles.cardTitle}>
          <ProjectIcon aria-hidden="true" />
          {title}
        </h2>
        {isMe && (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AddButton label="Projet" onClick={() => onAdd("projects")} />
            <AddButton label="Dépôt GitHub" onClick={() => onAdd("repositories")} />
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>
          {isMe ? "Présentez vos projets et vos dépôts : c'est la première chose que regardent les recruteurs et les autres développeurs." : "Aucun projet présenté pour l'instant."}
        </p>
      ) : (
        <ul className={styles.repoGrid}>
          {shown.map((item) =>
            item.type === "project" ? (
              <li key={item.p.id}>
                <article className={styles.repo}>
                  <div className={styles.repoHead}>
                    <ProjectIcon aria-hidden="true" />
                    <h3 className={styles.repoName}>{item.p.title}</h3>
                    {item.p.is_featured && <span className={styles.repoBadge}>Épinglé</span>}
                  </div>
                  {item.p.role && <p className={styles.repoDesc}>Rôle : {item.p.role}</p>}
                  {item.p.description && <p className={styles.repoDesc}>{item.p.description}</p>}
                  {item.p.technologies.length > 0 && (
                    <ul className={styles.interests} style={{ marginTop: 0 }}>
                      {item.p.technologies.map((t) => (
                        <li key={t}>{skillName(t)}</li>
                      ))}
                    </ul>
                  )}
                  <div className={styles.repoMeta}>
                    {(item.p.started_on || item.p.ended_on) && (
                      <span>
                        {month(item.p.started_on)}
                        {item.p.ended_on ? ` — ${month(item.p.ended_on)}` : item.p.started_on ? " — en cours" : ""}
                      </span>
                    )}
                    {item.p.links.map((l) => (
                      <a key={l.url} className={styles.link} href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                        {l.kind === "repository" ? <CodeIcon aria-hidden="true" /> : <ExternalIcon aria-hidden="true" />}
                        {l.kind === "repository" ? "Code" : l.kind === "demo" ? "Démo" : l.kind === "article" ? "Article" : "Lien"}
                      </a>
                    ))}
                  </div>
                  {isMe && <RemoveButton label={item.p.title} onClick={() => ask({ kind: "projects", id: item.p.id, label: item.p.title })} />}
                </article>
              </li>
            ) : (
              <li key={item.r.id}>
                <article className={styles.repo}>
                  <div className={styles.repoHead}>
                    <RepoIcon aria-hidden="true" />
                    <h3 className={styles.repoName}>
                      <a href={item.r.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "inherit" }}>
                        {item.r.full_name}
                      </a>
                    </h3>
                    <span className={styles.repoBadge}>{item.r.owner_verified ? "Propriétaire vérifié" : item.r.verified ? "Vérifié sur GitHub" : "Déclaré"}</span>
                  </div>
                  {item.r.description && <p className={styles.repoDesc}>{item.r.description}</p>}
                  <div className={styles.repoMeta}>
                    {item.r.language && (
                      <span className={styles.lang} style={{ ["--lang-color" as string]: LANG_COLORS[item.r.language.toLowerCase()] ?? "#8a3a12" }}>
                        {item.r.language}
                      </span>
                    )}
                    {item.r.stars != null && (
                      <span>
                        <StarIcon aria-hidden="true" />
                        {item.r.stars}
                      </span>
                    )}
                    <span>{item.r.provider === "gitlab" ? "GitLab" : "GitHub"}</span>
                  </div>
                  {isMe && <RemoveButton label={item.r.full_name} onClick={() => ask({ kind: "repositories", id: item.r.id, label: item.r.full_name })} />}
                </article>
              </li>
            ),
          )}
        </ul>
      )}
      {dialog}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Aperçu                                                              */
/* ------------------------------------------------------------------ */

export function AboutCard({ profile, isMe, onEdit }: { profile: Profile; isMe: boolean; onEdit: () => void }) {
  return (
    <section className={styles.card} aria-labelledby="profil-apropos">
      <div className={styles.cardHead}>
        <h2 id="profil-apropos" className={styles.cardTitle}>
          <UserIcon aria-hidden="true" />
          À propos
        </h2>
      </div>
      {profile.bio ? (
        <p className={styles.bio}>{profile.bio}</p>
      ) : (
        <p className={styles.empty}>
          {isMe ? (
            <>
              Présentez-vous en quelques lignes : votre spécialité, ce que vous construisez, ce que vous cherchez.{" "}
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={onEdit}>
                Écrire ma bio
              </button>
            </>
          ) : (
            "Pas encore de présentation."
          )}
        </p>
      )}
    </section>
  );
}

export function SkillsCard({ profile, isMe, onEdit }: { profile: Profile; isMe: boolean; onEdit: () => void }) {
  const skills = useMemo(() => [...profile.skills].sort((a, b) => b.level - a.level), [profile.skills]);
  return (
    <section className={styles.card} aria-labelledby="profil-competences">
      <div className={styles.cardHead}>
        <h2 id="profil-competences" className={styles.cardTitle}>
          <SparklesIcon aria-hidden="true" />
          Compétences
        </h2>
        {skills.length > 0 && <span className={styles.cardNote}>{skills.length}</span>}
      </div>
      {skills.length === 0 ? (
        <p className={styles.empty}>
          {isMe ? (
            <>
              Ajoutez vos compétences avec votre niveau.{" "}
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={onEdit}>
                Ajouter
              </button>
            </>
          ) : (
            "Aucune compétence renseignée."
          )}
        </p>
      ) : (
        <ul className={styles.skills}>
          {skills.map((s) => (
            <li key={s.slug} className={styles.skill} style={{ ["--level-color" as string]: LEVEL_COLORS[s.level - 1] }}>
              {s.name}
              <span className={styles.skillLevel}>{SKILL_LEVELS[s.level - 1]}</span>
            </li>
          ))}
        </ul>
      )}
      {profile.interests.length > 0 && (
        <>
          <h3 className={styles.cardNote} style={{ margin: "16px 0 0" }}>
            Centres d&apos;intérêt
          </h3>
          <ul className={styles.interests}>
            {profile.interests.map((i) => (
              <li key={i}>{i.replace(/-/g, " ")}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Parcours                                                            */
/* ------------------------------------------------------------------ */

export function JourneyCard({ portfolio, isMe, onAdd }: { portfolio: Portfolio | undefined; isMe: boolean; onAdd: (kind: AddKind) => void }) {
  const { ask, dialog } = useRemove(portfolio?.owner.username ?? "");
  const experiences = portfolio?.experiences ?? [];
  const educations = [...(portfolio?.educations ?? [])].sort((a, b) => (b.started_on ?? "").localeCompare(a.started_on ?? ""));
  return (
    <section className={styles.card} aria-labelledby="profil-parcours">
      <div className={styles.cardHead}>
        <h2 id="profil-parcours" className={styles.cardTitle}>
          <TimelineIcon aria-hidden="true" />
          Parcours
        </h2>
        {isMe && (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AddButton label="Expérience" onClick={() => onAdd("experiences")} />
            <AddButton label="Formation" onClick={() => onAdd("educations")} />
          </span>
        )}
      </div>
      {experiences.length + educations.length === 0 ? (
        <p className={styles.empty}>{isMe ? "Ajoutez vos expériences et vos formations pour raconter votre parcours." : "Aucun parcours renseigné."}</p>
      ) : (
        <ol className={styles.timeline}>
          {experiences.map((e) => (
            <li key={e.id} className={styles.step} data-current={!e.ended_on || undefined}>
              <div className={styles.stepHead}>
                <h3 className={styles.stepTitle}>{e.title}</h3>
                <span className={styles.stepDates}>
                  {month(e.started_on)} — {e.ended_on ? month(e.ended_on) : "aujourd'hui"}
                </span>
              </div>
              <p className={styles.stepOrg}>
                {e.company_name}
                {e.location && ` · ${e.location}`}
              </p>
              {e.description && <p className={styles.stepText}>{e.description}</p>}
              {isMe && <RemoveButton label={e.title} onClick={() => ask({ kind: "experiences", id: e.id, label: e.title })} />}
            </li>
          ))}
          {educations.map((e) => (
            <li key={e.id} className={styles.step}>
              <div className={styles.stepHead}>
                <h3 className={styles.stepTitle}>{[e.degree, e.field].filter(Boolean).join(" — ") || "Formation"}</h3>
                {(e.started_on || e.ended_on) && (
                  <span className={styles.stepDates}>
                    {month(e.started_on)}
                    {e.ended_on ? ` — ${month(e.ended_on)}` : ""}
                  </span>
                )}
              </div>
              <p className={styles.stepOrg}>{e.institution}</p>
              {isMe && <RemoveButton label={e.institution} onClick={() => ask({ kind: "educations", id: e.id, label: e.institution })} />}
            </li>
          ))}
        </ol>
      )}
      {dialog}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Certificats et réalisations                                         */
/* ------------------------------------------------------------------ */

export function CertificatesCard({ portfolio, isMe, onAdd }: { portfolio: Portfolio | undefined; isMe: boolean; onAdd: (kind: AddKind) => void }) {
  const { ask, dialog } = useRemove(portfolio?.owner.username ?? "");
  const certificates = portfolio?.certificates ?? [];
  const achievements = portfolio?.achievements ?? [];
  return (
    <section className={styles.card} aria-labelledby="profil-certificats">
      <div className={styles.cardHead}>
        <h2 id="profil-certificats" className={styles.cardTitle}>
          <AwardIcon aria-hidden="true" />
          Certificats et réalisations
        </h2>
        {isMe && (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AddButton label="Certificat LE BAOBAB" onClick={() => onAdd("certificates")} />
            <AddButton label="Réalisation" onClick={() => onAdd("achievements")} />
          </span>
        )}
      </div>
      {certificates.length + achievements.length === 0 ? (
        <p className={styles.empty}>
          {isMe ? "Vos certificats LE BAOBAB (obtenus dans Learn) et vos réalisations (prix, hackathons, publications) apparaîtront ici." : "Aucun certificat ni réalisation."}
        </p>
      ) : (
        <ul className={styles.certs}>
          {certificates.map((c) => (
            <li key={c.id} className={styles.cert}>
              <span className={styles.certIcon} aria-hidden="true">
                <VerifiedIcon />
              </span>
              <div>
                <p className={styles.certName}>
                  {c.name}
                  {c.verified_by_platform && <span className={styles.verifiedTag}>Vérifiable</span>}
                </p>
                <p className={styles.certMeta}>
                  {[c.issuer, c.issued_on && `délivré le ${DAY.format(new Date(c.issued_on))}`].filter(Boolean).join(" · ")}
                  {c.credential_url && (
                    <>
                      {" · "}
                      <a href={c.credential_url} target="_blank" rel="noopener noreferrer">
                        Vérifier
                      </a>
                    </>
                  )}
                </p>
              </div>
              {isMe && <RemoveButton label={c.name} onClick={() => ask({ kind: "certificates", id: c.id, label: c.name })} />}
            </li>
          ))}
          {achievements.map((a) => (
            <li key={a.id} className={styles.cert}>
              <span className={styles.certIcon} aria-hidden="true">
                <AwardIcon />
              </span>
              <div>
                <p className={styles.certName}>{a.title}</p>
                <p className={styles.certMeta}>
                  {[a.issuer, a.achieved_on && month(a.achieved_on)].filter(Boolean).join(" · ")}
                  {a.url && (
                    <>
                      {" · "}
                      <a href={a.url} target="_blank" rel="noopener noreferrer nofollow">
                        Voir
                      </a>
                    </>
                  )}
                </p>
              </div>
              {isMe && <RemoveButton label={a.title} onClick={() => ask({ kind: "achievements", id: a.id, label: a.title })} />}
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Complétion du profil (mon profil uniquement)                        */
/* ------------------------------------------------------------------ */

export function completionItems(profile: Profile, portfolio: Portfolio | undefined) {
  return [
    { label: "Photo de profil", done: Boolean(profile.avatar_url) },
    { label: "Photo de couverture", done: Boolean(profile.cover_url) },
    { label: "Titre (ce que vous faites)", done: Boolean(profile.headline) },
    { label: "Présentation", done: Boolean(profile.bio) },
    { label: "Pays", done: Boolean(profile.country) },
    { label: "Métier", done: Boolean(profile.profession) },
    { label: "Au moins 3 compétences", done: profile.skills.length >= 3 },
    { label: "Un lien (GitHub, LinkedIn…)", done: profile.links.length > 0 },
    { label: "Un projet ou un dépôt", done: Boolean(portfolio && portfolio.projects.length + portfolio.repositories.length > 0) },
    { label: "Une expérience ou une formation", done: Boolean(portfolio && portfolio.experiences.length + portfolio.educations.length > 0) },
  ];
}

export function CompletionCard({ profile, portfolio, onEdit }: { profile: Profile; portfolio: Portfolio | undefined; onEdit: () => void }) {
  const items = completionItems(profile, portfolio);
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  return (
    <section className={cx(styles.card, styles.completion)} aria-labelledby="profil-completion">
      <div className={styles.completionHead}>
        <h2 id="profil-completion" className={styles.cardTitle} style={{ fontSize: 15 }}>
          Profil complété
        </h2>
        <strong>{percent}&nbsp;%</strong>
      </div>
      <span className={styles.gauge} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-labelledby="profil-completion">
        <span style={{ width: `${percent}%` }} />
      </span>
      <ul className={styles.todo}>
        {items.map((i) => (
          <li key={i.label} data-done={i.done || undefined}>
            {i.label}
          </li>
        ))}
      </ul>
      {percent < 100 && (
        <button type="button" className={cx(ui.button, ui.primary, ui.block)} onClick={onEdit}>
          Compléter mon profil
        </button>
      )}
    </section>
  );
}
