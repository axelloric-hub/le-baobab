"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useAssignment, useCourse, useGrade, useSubmissions, useSubmitAssignment } from "@/features/learn/hooks";
import type { Assignment, Submission } from "@/features/learn/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { relativeTime } from "@/lib/format";
import { uploadFile } from "@/lib/uploads/upload";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Field } from "../ui/Field";
import { ArrowLeftIcon, CheckIcon, FileIcon, LockIcon, PaperclipIcon, SendIcon, TrashIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { LessonText } from "./LessonText";
import { ROUTES } from "@/lib/routes";
import styles from "./Learn.module.css";

const DUE = new Intl.DateTimeFormat("fr", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function SubmissionCard({ submission, assignment, staff }: { submission: Submission; assignment: Assignment; staff: boolean }) {
  const toast = useToast();
  const grade = useGrade(assignment.id);
  const [points, setPoints] = useState(submission.grade ? String(submission.grade.points) : "");
  const [feedback, setFeedback] = useState(submission.grade?.feedback ?? "");
  const who = submission.student ?? submission.submitted_by;
  const value = Number(points.replace(",", "."));
  return (
    <article className={layout.panelCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {staff && <Avatar name={who.display_name || who.username} src={who.avatar_url} size={36} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ color: "var(--bb-brown-950)" }}>{staff ? who.display_name || who.username : `Rendu n° ${submission.attempt_no}`}</strong>
          <span className={ui.hint} style={{ display: "block", margin: 0 }}>
            {relativeTime(submission.submitted_at)}
            {submission.group && ` · groupe ${submission.group}`}
          </span>
        </span>
        {submission.is_late && <Pill tone="amber">En retard</Pill>}
        {submission.grade ? (
          <Pill tone="green">
            {submission.grade.points} / {assignment.max_points}
          </Pill>
        ) : (
          <Pill tone="neutral">À corriger</Pill>
        )}
      </div>
      {submission.text && (
        <div style={{ marginTop: 12 }}>
          <LessonText text={submission.text} />
        </div>
      )}
      {submission.attachments.length > 0 && (
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 0", padding: 0, listStyle: "none" }}>
          {submission.attachments.map((a) => (
            <li key={a.url}>
              <a className={cx(ui.button, ui.secondary, ui.small)} href={a.url} target="_blank" rel="noreferrer noopener">
                <FileIcon />
                {a.filename}
              </a>
            </li>
          ))}
        </ul>
      )}
      {submission.grade?.feedback && !staff && (
        <div className={styles.score} style={{ marginTop: 12, background: "var(--bb-surface-warm)" }}>
          <span>
            <strong style={{ display: "block", color: "var(--bb-brown-950)" }}>Commentaire de l&apos;enseignant</strong>
            <span style={{ whiteSpace: "pre-line" }}>{submission.grade.feedback}</span>
          </span>
        </div>
      )}
      {staff && (
        <div className={layout.stack} style={{ gap: 8, marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 8 }}>
            <input className={ui.input} inputMode="decimal" aria-label="Note" placeholder={`/ ${assignment.max_points}`} value={points} onChange={(e) => setPoints(e.target.value)} />
            <input className={ui.input} aria-label="Commentaire" placeholder="Commentaire pour l'élève" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <button
            type="button"
            className={cx(ui.button, ui.primary, ui.small)}
            style={{ alignSelf: "flex-start" }}
            disabled={!(value >= 0 && value <= assignment.max_points) || points === "" || grade.isPending}
            onClick={() =>
              grade.mutate(
                { id: submission.id, points: value, feedback: feedback.trim() },
                { onSuccess: () => toast("Note enregistrée.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) },
              )
            }
          >
            <CheckIcon />
            {submission.grade ? "Modifier la note" : "Noter"}
          </button>
        </div>
      )}
    </article>
  );
}

function SubmitForm({ assignment, count }: { assignment: Assignment; count: number }) {
  const toast = useToast();
  const submit = useSubmitAssignment(assignment.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Array<{ name: string; id?: string; progress: number; error?: string }>>([]);
  const left = assignment.max_attempts - count;
  const late = assignment.due_at ? new Date(assignment.due_at) < new Date() : false;
  if (left <= 0) return <p className={ui.hint}>Vous avez utilisé tous vos rendus pour ce devoir.</p>;
  if (late && !assignment.allow_late) return <p className={ui.hint}>La date limite est passée : ce devoir n&apos;accepte plus de rendus.</p>;

  const add = async (list: FileList) => {
    const base = files.length;
    for (const [i, f] of Array.from(list).slice(0, 10 - base).entries()) {
      const index = base + i;
      setFiles((x) => [...x, { name: f.name, progress: 0 }]);
      try {
        const id = await uploadFile(f, "assignment_submission", { onProgress: (progress) => setFiles((x) => x.map((y, j) => (j === index ? { ...y, progress } : y))) });
        setFiles((x) => x.map((y, j) => (j === index ? { ...y, id, progress: 1 } : y)));
      } catch (error) {
        setFiles((x) => x.map((y, j) => (j === index ? { ...y, error: describeError(error) } : y)));
      }
    }
  };
  const uploading = files.some((f) => !f.id && !f.error);
  const ready = (text.trim() || files.some((f) => f.id)) && !uploading;

  return (
    <section className={layout.panelCard} aria-labelledby="rendre">
      <h2 id="rendre" className={layout.panelTitle}>
        <SendIcon aria-hidden="true" />
        Rendre le devoir
      </h2>
      <div className={layout.form}>
        <Field id="submission-text" label="Votre réponse" hint="Texte, liens, blocs de code entre ```.">
          <textarea id="submission-text" className={ui.textarea} style={{ minHeight: 160 }} maxLength={50000} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className={layout.stack} style={{ gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} className={styles.fileCard} style={{ padding: 10 }}>
              <span className={styles.fileText}>
                <strong>{f.name}</strong>
                <small>{f.error ?? (f.id ? "Envoyé" : `Envoi… ${Math.round(f.progress * 100)} %`)}</small>
              </span>
              <button type="button" className={ui.iconButton} aria-label={`Retirer ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                <TrashIcon />
              </button>
            </div>
          ))}
          {files.length < 10 && (
            <button type="button" className={cx(ui.button, ui.secondary, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => fileRef.current?.click()}>
              <PaperclipIcon />
              Joindre des fichiers (PDF, Word, ZIP, images)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            onChange={(e) => {
              if (e.target.files) void add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {late && <p className={ui.hint}>Date limite dépassée : votre rendu sera marqué « en retard ».</p>}
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          style={{ alignSelf: "flex-start" }}
          disabled={!ready || submit.isPending}
          onClick={() =>
            submit.mutate(
              { text: text.trim(), files: files.filter((f) => f.id).map((f) => f.id!) },
              {
                onSuccess: () => {
                  setText("");
                  setFiles([]);
                  toast("Devoir rendu.", { tone: "success" });
                },
                onError: (e) => toast(describeError(e), { tone: "error" }),
              },
            )
          }
        >
          <SendIcon />
          {submit.isPending ? "Envoi…" : "Rendre"}
        </button>
        <p className={ui.hint} style={{ margin: 0 }}>
          {left} rendu{left > 1 ? "s" : ""} possible{left > 1 ? "s" : ""}.
        </p>
      </div>
    </section>
  );
}

export function AssignmentPage({ id }: { id: string }) {
  const assignment = useAssignment(id);
  const course = useCourse(assignment.data?.course ?? "");
  const submissions = useSubmissions(id);
  const list = useMemo(() => submissions.data?.pages.flatMap((p) => p.results) ?? [], [submissions.data]);

  if (assignment.isPending) return <Skeleton height={300} radius={18} />;
  if (assignment.isError) {
    const gone = assignment.error instanceof ApiError && assignment.error.status === 404;
    return gone ? <EmptyState icon={<LockIcon />} title="Devoir introuvable" text="Ce devoir n'existe pas ou vous n'êtes pas inscrit au cours." /> : <ErrorState error={assignment.error} onRetry={() => assignment.refetch()} />;
  }
  const a = assignment.data;
  const staff = Boolean(course.data?.is_staff);

  return (
    <div className={layout.page}>
      <Link href={`${ROUTES.course(a.course)}?onglet=devoirs`} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        {course.data?.title ?? "Retour au cours"}
      </Link>
      <div className={layout.layout}>
        <div className={layout.column}>
          <section className={styles.lesson}>
            <p className={styles.lessonKicker}>Devoir · noté sur {a.max_points}</p>
            <h1 className={styles.lessonTitle}>{a.title}</h1>
            {a.due_at && (
              <p className={ui.hint} style={{ margin: 0 }}>
                À rendre avant le {DUE.format(new Date(a.due_at))}
                {a.allow_late ? " (retards acceptés et signalés)" : ""}
              </p>
            )}
            {a.instructions ? <LessonText text={a.instructions} /> : <p className={ui.hint}>Pas de consignes particulières.</p>}
          </section>
          <section aria-labelledby="rendus" className={layout.stack}>
            <h2 id="rendus" className={layout.sectionTitle}>
              {staff ? "Rendus des élèves" : "Mes rendus"}
            </h2>
            {submissions.isPending ? (
              <Skeleton height={100} radius={18} />
            ) : list.length === 0 ? (
              <EmptyState icon={<FileIcon />} title={staff ? "Aucun rendu pour l'instant" : "Pas encore rendu"} />
            ) : (
              list.map((s) => <SubmissionCard key={s.id} submission={s} assignment={a} staff={staff} />)
            )}
          </section>
        </div>
        {!staff && (
          <aside className={layout.stack} aria-label="Rendre">
            <SubmitForm assignment={a} count={list.length} />
          </aside>
        )}
      </div>
    </div>
  );
}
