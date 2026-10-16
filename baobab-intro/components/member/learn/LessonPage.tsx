"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChapter, useCourse, useRecordProgress } from "@/features/learn/hooks";
import { ApiError, describeError } from "@/lib/api/errors";
import { ROUTES } from "@/lib/routes";
import { cx } from "../ui/cx";
import { ArrowLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon, PlusIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { Block } from "./Blocks";
import { ProgressBar } from "./CourseCard";
import { AddBlockDialog, QuizBuilderDialog } from "./CourseEditor";
import { Outline } from "./CoursePage";
import { ACCESS, duration } from "./labels";
import styles from "./Learn.module.css";

/** Temps de lecture envoyé au serveur toutes les minutes (onglet visible), plafonné à 1 h par envoi côté serveur. */
const HEARTBEAT_MS = 60_000;

export function LessonPage({ courseId, chapterId }: { courseId: string; chapterId: string }) {
  const router = useRouter();
  const toast = useToast();
  const course = useCourse(courseId);
  const chapter = useChapter(chapterId);
  const record = useRecordProgress(courseId);
  const [adding, setAdding] = useState<null | "block" | "quiz">(null);
  const started = useRef(Date.now());

  const flat = useMemo(() => course.data?.modules.flatMap((m) => m.chapters.map((ch) => ({ ...ch, module: m }))) ?? [], [course.data]);
  const index = flat.findIndex((ch) => ch.id === chapterId);
  const current = flat[index];
  const prev = index > 0 ? flat[index - 1] : null;
  const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : null;
  const tracking = Boolean(course.data?.enrolled && chapter.data);
  const done = current?.my_progress?.status === "completed";

  // Ouverture du chapitre : il passe « en cours » ; puis le temps passé est envoyé chaque minute.
  const { mutate } = record;
  useEffect(() => {
    if (!tracking) return;
    started.current = Date.now();
    mutate({ chapterId, percent: 10, seconds: 0 });
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const seconds = Math.round((Date.now() - started.current) / 1000);
      started.current = Date.now();
      mutate({ chapterId, percent: 10, seconds });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [tracking, chapterId, mutate]);

  const finish = (goNext: boolean) => {
    const seconds = Math.round((Date.now() - started.current) / 1000);
    started.current = Date.now();
    record.mutate(
      { chapterId, percent: 100, seconds },
      {
        onSuccess: (r) => {
          if (r.course.percent >= 100) toast("Bravo, vous avez terminé le cours !", { tone: "success" });
          else if (!goNext) toast("Chapitre terminé.", { tone: "success" });
          if (goNext && next?.access.allowed) router.push(ROUTES.lesson(courseId, next.id));
        },
        onError: (e) => toast(describeError(e), { tone: "error" }),
      },
    );
  };

  if (course.isPending) {
    return (
      <div className={styles.player} aria-busy="true">
        <Skeleton height={400} radius={18} />
        <Skeleton height={500} radius={18} />
      </div>
    );
  }
  if (course.isError) return <ErrorState error={course.error} onRetry={() => course.refetch()} />;
  const c = course.data;

  let body: React.ReactNode;
  if (chapter.isPending) body = <Skeleton height={300} radius={12} />;
  else if (chapter.isError) {
    const reason = chapter.error instanceof ApiError ? chapter.error.code : "";
    body = (
      <EmptyState
        icon={<LockIcon />}
        title={chapter.error instanceof ApiError && chapter.error.status === 404 ? "Chapitre introuvable" : "Chapitre verrouillé"}
        text={ACCESS[reason as keyof typeof ACCESS] || describeError(chapter.error)}
        actions={
          <Link href={ROUTES.course(courseId)} className={cx(ui.button, ui.primary)}>
            Voir le cours
          </Link>
        }
      />
    );
  } else {
    const blocks = chapter.data.blocks;
    body =
      blocks.length === 0 ? (
        <EmptyState icon={<PlusIcon />} title="Chapitre vide" text={c.is_staff ? "Ajoutez du texte, une vidéo, un document, du code ou un quiz." : "Le contenu de ce chapitre arrive bientôt."} />
      ) : (
        blocks.map((b) => <Block key={b.id} block={b} />)
      );
  }

  return (
    <div className={styles.player}>
      <nav className={styles.playerNav} aria-label="Programme du cours">
        {c.enrolled && c.progress && (
          <div className={layout.panelCard} style={{ padding: 14 }}>
            <ProgressBar progress={c.progress} label="Progression dans le cours" />
          </div>
        )}
        <Outline course={c} currentChapter={chapterId} />
      </nav>

      <article className={styles.lesson} aria-labelledby="titre-chapitre">
        <Link href={ROUTES.course(courseId)} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start", marginLeft: -8 }}>
          <ArrowLeftIcon />
          {c.title}
        </Link>
        <header>
          <p className={styles.lessonKicker}>
            {current ? `Module ${c.modules.findIndex((m) => m.id === current.module.id) + 1} · ${current.module.title}` : c.title}
          </p>
          <h1 id="titre-chapitre" className={styles.lessonTitle}>
            {chapter.data?.title ?? current?.title ?? "Chapitre"}
          </h1>
          {current && <p className={ui.hint}>{duration(current.estimated_minutes)} de lecture estimée</p>}
        </header>

        {c.is_staff && chapter.data && (
          <div className={styles.editorBar}>
            <strong>Contenu du chapitre</strong>
            <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setAdding("block")}>
              <PlusIcon />
              Ajouter du contenu
            </button>
            <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setAdding("quiz")}>
              <PlusIcon />
              Quiz
            </button>
          </div>
        )}

        {body}

        <footer className={styles.lessonNav}>
          {prev ? (
            <Link href={ROUTES.lesson(courseId, prev.id)} className={cx(ui.button, ui.ghost)} aria-label={`Chapitre précédent : ${prev.title}`}>
              <ChevronLeftIcon />
              Précédent
            </Link>
          ) : (
            <span />
          )}
          {tracking && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {!done && (
                <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => finish(false)} disabled={record.isPending}>
                  <CheckIcon />
                  Marquer comme terminé
                </button>
              )}
              {next ? (
                <button type="button" className={cx(ui.button, ui.primary)} onClick={() => (done ? router.push(ROUTES.lesson(courseId, next.id)) : finish(true))} disabled={record.isPending || !next.access.allowed}>
                  {next.access.allowed ? "Chapitre suivant" : "Suivant verrouillé"}
                  <ChevronRightIcon />
                </button>
              ) : (
                done && (
                  <Link href={ROUTES.course(courseId)} className={cx(ui.button, ui.primary)}>
                    Retour au cours
                  </Link>
                )
              )}
            </div>
          )}
          {!tracking && next && next.access.allowed && (
            <Link href={ROUTES.lesson(courseId, next.id)} className={cx(ui.button, ui.primary)}>
              Chapitre suivant
              <ChevronRightIcon />
            </Link>
          )}
        </footer>
      </article>

      {c.is_staff && (
        <>
          <AddBlockDialog courseId={courseId} chapterId={chapterId} open={adding === "block"} onClose={() => setAdding(null)} onQuiz={() => setAdding("quiz")} />
          <QuizBuilderDialog courseId={courseId} chapterId={chapterId} open={adding === "quiz"} onClose={() => setAdding(null)} />
        </>
      )}
    </div>
  );
}
