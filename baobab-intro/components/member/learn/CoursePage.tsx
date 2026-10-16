"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAssignments, useCertificates, useCourse, useCourseEditor, useEnroll, useStudents } from "@/features/learn/hooks";
import type { ChapterSummary, CourseOutline } from "@/features/learn/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { relativeTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { BuyAccess } from "../shop/BuyAccess";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { ArrowLeftIcon, AwardIcon, CheckIcon, ClockIcon, FileIcon, LearnIcon, ListIcon, LockIcon, MoreIcon, PenIcon, PlayIcon, PlusIcon, SendIcon, UsersIcon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { coverStyle, priceLabel, ProgressBar } from "./CourseCard";
import { AddChapterDialog, AddModuleDialog, AssignmentDialog, EditCourseDialog } from "./CourseEditor";
import { ACCESS, duration, LANGUAGES, LEVELS } from "./labels";
import styles from "./Learn.module.css";

const TAB_IDS = ["programme", "devoirs", "eleves"] as const;
const DUE = new Intl.DateTimeFormat("fr", { weekday: "long", day: "numeric", month: "long" });

/** Premier chapitre ouvert non terminé (pour « Continuer »), sinon le premier ouvert. */
export function nextChapter(course: CourseOutline): ChapterSummary | null {
  const all = course.modules.flatMap((m) => m.chapters);
  return all.find((ch) => ch.access.allowed && ch.my_progress?.status !== "completed") ?? all.find((ch) => ch.access.allowed) ?? null;
}

export function ChapterState({ chapter, index }: { chapter: ChapterSummary; index: number }) {
  const state = chapter.my_progress?.status;
  if (state === "completed") {
    return (
      <span className={styles.chapterState} data-state="completed" aria-label="Terminé">
        <CheckIcon />
      </span>
    );
  }
  if (!chapter.access.allowed) {
    return (
      <span className={styles.chapterState} aria-label="Verrouillé">
        <LockIcon />
      </span>
    );
  }
  return (
    <span className={styles.chapterState} data-state={state} aria-hidden="true">
      {index}
    </span>
  );
}

/** Plan du cours : modules et chapitres, état de chacun, ajout de contenu pour l'enseignant. */
export function Outline({ course, currentChapter, onAddChapter }: { course: CourseOutline; currentChapter?: string; onAddChapter?: (moduleId: string) => void }) {
  if (course.modules.length === 0) {
    return <EmptyState icon={<ListIcon />} title="Programme en préparation" text={course.is_staff ? "Ajoutez un premier module, puis ses chapitres." : "Les enseignants préparent ce cours."} />;
  }
  return (
    <div className={styles.outline}>
      {course.modules.map((m, mi) => {
        const minutes = m.chapters.reduce((n, ch) => n + ch.estimated_minutes, 0);
        return (
          <section key={m.id} className={styles.module} aria-labelledby={`module-${m.id}`}>
            <div className={styles.moduleHead}>
              <span className={styles.moduleIndex} aria-hidden="true">
                {mi + 1}
              </span>
              <h3 id={`module-${m.id}`} className={styles.moduleTitle}>
                {m.title}
              </h3>
              <span className={styles.moduleMeta}>
                {m.chapters.length} chap. {minutes > 0 && `· ${duration(minutes)}`}
                {!m.is_free && m.price_minor ? ` · ${formatMoney(m.price_minor, m.currency)}` : ""}
              </span>
            </div>
            <ol className={styles.chapters}>
              {m.chapters.map((ch, ci) => {
                const content = (
                  <>
                    <ChapterState chapter={ch} index={ci + 1} />
                    <span className={styles.chapterTitle}>{ch.title}</span>
                    <span className={styles.chapterMeta}>
                      {!ch.is_free && ch.price_minor ? `${formatMoney(ch.price_minor, ch.currency)} · ` : ""}
                      {duration(ch.estimated_minutes)}
                    </span>
                  </>
                );
                return (
                  <li key={ch.id}>
                    {ch.access.allowed ? (
                      <Link href={ROUTES.lesson(course.id, ch.id)} className={styles.chapter} aria-current={currentChapter === ch.id ? "page" : undefined}>
                        {content}
                      </Link>
                    ) : (
                      <span className={styles.chapter} data-locked="" title={ACCESS[ch.access.reason]}>
                        {content}
                      </span>
                    )}
                  </li>
                );
              })}
              {onAddChapter && (
                <li>
                  <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ margin: "4px 6px 6px" }} onClick={() => onAddChapter(m.id)}>
                    <PlusIcon />
                    Ajouter un chapitre
                  </button>
                </li>
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function EnrollCard({ course }: { course: CourseOutline }) {
  const toast = useToast();
  const { enroll, drop } = useEnroll(course.id);
  const certificates = useCertificates();
  const [dropping, setDropping] = useState(false);
  const next = nextChapter(course);
  const certificate = certificates.data?.find((c) => c.course === course.title);
  const paidChapters = course.modules.some((m) => m.chapters.some((ch) => !ch.access.allowed && ch.access.reason === "payment_required"));

  if (course.status !== "published") return null;
  if (!course.enrolled) {
    return (
      <section className={layout.panelCard}>
        <p className={layout.panelTitle} style={{ marginBottom: 6 }}>
          {priceLabel(course)}
        </p>
        <button
          type="button"
          className={cx(ui.button, ui.primary, ui.block)}
          disabled={enroll.isPending}
          onClick={() =>
            enroll.mutate(undefined, {
              onSuccess: () => toast("Inscription confirmée : bon apprentissage !", { tone: "success" }),
              onError: (e) => toast(describeError(e), { tone: "error" }),
            })
          }
        >
          <LearnIcon />
          {enroll.isPending ? "Inscription…" : "S'inscrire au cours"}
        </button>
        <p className={ui.hint}>
          {course.is_free ? "Inscription gratuite : votre progression est enregistrée." : "L'inscription est gratuite ; les chapitres payants se débloquent à l'achat dans la Boutique."}
        </p>
        {(!course.is_free || paidChapters) && <BuyAccess course={course.id} />}
      </section>
    );
  }
  const done = (course.progress?.percent ?? 0) >= 100;
  return (
    <section className={layout.panelCard} aria-labelledby="ma-progression">
      <h2 id="ma-progression" className={layout.panelTitle}>
        <LearnIcon aria-hidden="true" />
        Ma progression
      </h2>
      {course.progress && <ProgressBar progress={course.progress} label="Progression dans le cours" />}
      <p className={ui.hint}>
        {course.progress?.completed_chapters ?? 0} chapitre(s) terminé(s) sur {course.progress?.total_chapters ?? 0}
      </p>
      {done && certificate ? (
        <Link href={ROUTES.certificate(certificate.verification_code)} className={cx(ui.button, ui.primary, ui.block)} target="_blank">
          <AwardIcon />
          Voir mon certificat
        </Link>
      ) : (
        next && (
          <Link href={ROUTES.lesson(course.id, next.id)} className={cx(ui.button, ui.primary, ui.block)}>
            <PlayIcon />
            {course.progress && course.progress.completed_chapters > 0 ? "Continuer" : "Commencer"}
          </Link>
        )
      )}
      {paidChapters && (
        <>
          <p className={ui.hint}>Certains chapitres sont payants : leur accès s&apos;achète dans la Boutique.</p>
          <BuyAccess course={course.id} />
        </>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Menu label="Gérer mon inscription" items={[{ label: "Abandonner le cours", tone: "danger", onSelect: () => setDropping(true) }]} trigger={<MoreIcon />} />
      </div>
      <ConfirmDialog
        open={dropping}
        busy={drop.isPending}
        onClose={() => setDropping(false)}
        title="Abandonner ce cours ?"
        text="Il disparaît de « Mes cours ». Votre progression est conservée si vous vous réinscrivez."
        confirm="Abandonner"
        onConfirm={() =>
          drop.mutate(undefined, {
            onSuccess: () => {
              setDropping(false);
              toast("Inscription annulée.", { tone: "success" });
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          })
        }
      />
    </section>
  );
}

function Assignments({ course }: { course: CourseOutline }) {
  const list = useAssignments(course.id, true);
  if (list.isPending) return <Skeleton height={120} radius={18} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  if (list.data.length === 0) return <EmptyState icon={<FileIcon />} title="Aucun devoir" text={course.is_staff ? "Créez un devoir : consignes, barème, date limite." : "Les devoirs du cours apparaîtront ici."} />;
  return (
    <ul className={layout.people}>
      {list.data.map((a) => (
        <li key={a.id}>
          <Link href={ROUTES.assignment(a.id)} className={layout.person} style={{ textDecoration: "none" }}>
            <span className={styles.fileIcon}>
              <FileIcon />
            </span>
            <span className={layout.personText}>
              <span className={layout.personName}>{a.title}</span>
              <span className={layout.personMeta}>
                Noté sur {a.max_points}
                {a.due_at && ` · à rendre avant ${DUE.format(new Date(a.due_at))}`}
              </span>
            </span>
            {a.due_at && new Date(a.due_at) < new Date() && <Pill tone="neutral">Échéance passée</Pill>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Students({ course }: { course: CourseOutline }) {
  const students = useStudents(course.id, true);
  const list = useMemo(() => students.data?.pages.flatMap((p) => p.results) ?? [], [students.data]);
  if (students.isPending) return <Skeleton height={120} radius={18} />;
  if (students.isError) return <ErrorState error={students.error} onRetry={() => students.refetch()} />;
  if (list.length === 0) return <EmptyState icon={<UsersIcon />} title="Aucun élève inscrit" text="Partagez le lien du cours une fois publié." />;
  return (
    <ul className={layout.people}>
      {list.map((s) => (
        <li key={s.username} className={layout.person}>
          <Avatar name={s.display_name || s.username} src={s.avatar_url} size={40} />
          <span className={layout.personText}>
            <Link href={ROUTES.profile(s.username)} className={layout.personName}>
              {s.display_name || s.username}
            </Link>
            <span className={layout.personMeta}>inscrit(e) {relativeTime(s.enrolled_at)}</span>
          </span>
          <span style={{ width: "min(220px, 40%)" }}>
            <ProgressBar progress={s.progress} label={`Progression de ${s.display_name || s.username}`} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CoursePage({ id }: { id: string }) {
  const query = useCourse(id);
  const toast = useToast();
  const editor = useCourseEditor(id);
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [dialog, setDialog] = useState<null | "edit" | "module" | "assignment">(null);
  const [chapterFor, setChapterFor] = useState<string | null>(null);

  if (query.isPending) {
    return (
      <div className={layout.page} aria-busy="true">
        <Skeleton height={220} radius={18} />
        <Skeleton height={320} radius={18} />
      </div>
    );
  }
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={ROUTES.learn} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Learn
        </Link>
        {gone ? <EmptyState icon={<LockIcon />} title="Cours introuvable" text="Ce cours n'existe pas, n'est pas publié, ou appartient à une classe dont vous n'êtes pas membre." /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }
  const c = query.data;
  const staff = c.is_staff;
  const tabs = [
    { id: "programme" as const, label: "Programme", Icon: ListIcon },
    ...(staff || c.enrolled ? [{ id: "devoirs" as const, label: "Devoirs", Icon: FileIcon }] : []),
    ...(staff ? [{ id: "eleves" as const, label: "Élèves", Icon: UsersIcon }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "programme";

  return (
    <div className={layout.page}>
      <section className={styles.hero}>
        <div className={styles.heroCover} style={coverStyle(c.title)}>
          <Link href={ROUTES.classroom(c.classroom)} className={styles.heroKicker}>
            <ArrowLeftIcon width={16} height={16} aria-hidden="true" />
            {c.classroom_title}
          </Link>
          <h1 className={styles.heroTitle}>{c.title}</h1>
          <ul className={styles.heroMeta}>
            <li>{LEVELS[c.level]}</li>
            <li>{LANGUAGES[c.language] ?? c.language}</li>
            <li>
              <ListIcon aria-hidden="true" />
              {c.stats.chapters} chapitre{c.stats.chapters > 1 ? "s" : ""}
            </li>
            {c.stats.minutes > 0 && (
              <li>
                <ClockIcon aria-hidden="true" />
                {duration(c.stats.minutes)}
              </li>
            )}
            {c.certificate_enabled && (
              <li>
                <AwardIcon aria-hidden="true" />
                Certificat
              </li>
            )}
            <li>{priceLabel(c)}</li>
          </ul>
        </div>
        <div className={styles.heroBody}>
          {c.teachers.length > 0 && (
            <ul className={styles.teachers} aria-label="Enseignants">
              {c.teachers.map((t) => (
                <li key={t.username}>
                  <Link href={ROUTES.profile(t.username)}>
                    <Avatar name={t.display_name || t.username} src={t.avatar_url} size={28} />
                    {t.display_name || t.username}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {c.description && <p className={styles.description}>{c.description}</p>}
        </div>
      </section>

      {staff && (
        <div className={styles.editorBar} role="toolbar" aria-label="Outils de l'enseignant">
          <strong>{c.status === "published" ? "Vous enseignez ce cours" : "Brouillon : seuls les enseignants le voient"}</strong>
          <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setDialog("module")}>
            <PlusIcon />
            Module
          </button>
          <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setDialog("assignment")}>
            <FileIcon />
            Devoir
          </button>
          <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setDialog("edit")}>
            <PenIcon />
            Modifier
          </button>
          {c.status !== "published" && (
            <button
              type="button"
              className={cx(ui.button, ui.primary, ui.small)}
              disabled={editor.publish.isPending}
              onClick={() =>
                editor.publish.mutate(undefined, {
                  onSuccess: () => toast("Cours publié : il est visible dans le catalogue.", { tone: "success" }),
                  onError: (e) => toast(describeError(e), { tone: "error" }),
                })
              }
            >
              <SendIcon />
              Publier
            </button>
          )}
        </div>
      )}

      <Tabs idPrefix="cours" label="Sections du cours" value={active} onChange={setTab} items={tabs} />
      <TabPanel idPrefix="cours" id={active}>
        <div className={layout.layout}>
          <div className={layout.column}>
            {active === "programme" && <Outline course={c} onAddChapter={staff ? (m) => setChapterFor(m) : undefined} />}
            {active === "devoirs" && <Assignments course={c} />}
            {active === "eleves" && <Students course={c} />}
          </div>
          <aside className={layout.stack} aria-label="Inscription">
            <EnrollCard course={c} />
          </aside>
        </div>
      </TabPanel>

      {staff && (
        <>
          {dialog === "edit" && <EditCourseDialog course={c} open onClose={() => setDialog(null)} />}
          <AddModuleDialog courseId={c.id} open={dialog === "module"} onClose={() => setDialog(null)} />
          <AssignmentDialog courseId={c.id} open={dialog === "assignment"} onClose={() => setDialog(null)} />
          <AddChapterDialog courseId={c.id} moduleId={chapterFor} open={chapterFor !== null} onClose={() => setChapterFor(null)} />
        </>
      )}
    </div>
  );
}
