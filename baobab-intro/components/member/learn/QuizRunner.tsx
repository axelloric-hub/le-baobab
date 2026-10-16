"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { learnApi } from "@/features/learn/api";
import { learnKeys, useAttempts, useQuiz } from "@/features/learn/hooks";
import type { Attempt, Quiz } from "@/features/learn/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { cx } from "../ui/cx";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CloseIcon, PollIcon, RefreshIcon } from "../ui/icons";
import { Pill } from "../ui/Pill";
import { Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Learn.module.css";

type Answers = Record<string, { selected?: string[]; text?: string }>;

function Result({ quiz, attempt, canRetry, onRetry }: { quiz: Quiz; attempt: Attempt; canRetry: boolean; onRetry: () => void }) {
  const percent = attempt.max_score ? Math.round((attempt.score / attempt.max_score) * 100) : 0;
  const pending = attempt.status === "pending_review";
  const verdicts = new Map((attempt.answers ?? []).map((a) => [a.question, a]));
  return (
    <>
      <div className={styles.score} role="status">
        <span className={styles.scoreValue}>{percent}&nbsp;%</span>
        <span style={{ flex: 1 }}>
          <strong style={{ display: "block", color: "var(--bb-brown-950)" }}>
            {pending ? "En attente de correction" : attempt.passed ? "Quiz réussi" : "Quiz non validé"}
          </strong>
          <span className={ui.hint} style={{ margin: 0 }}>
            {attempt.score} / {attempt.max_score} point{attempt.max_score > 1 ? "s" : ""} · réussite à {quiz.pass_percent}&nbsp;% · tentative {attempt.attempt_no}
          </span>
        </span>
        {pending ? <Pill tone="amber">À corriger</Pill> : attempt.passed ? <Pill tone="green">Réussi</Pill> : <Pill tone="red">À retenter</Pill>}
      </div>
      <ol style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
        {quiz.questions.map((q, i) => {
          const v = verdicts.get(q.id);
          return (
            <li key={q.id} className={styles.question} data-result={v?.is_correct === true ? "correct" : v?.is_correct === false ? "wrong" : undefined}>
              <p style={{ margin: 0, fontWeight: 650 }}>
                {i + 1}. {q.prompt}
              </p>
              {v && (
                <p className={styles.verdict} data-ok={v.is_correct === true || undefined} data-ko={v.is_correct === false || undefined}>
                  {v.is_correct === true ? (
                    <>
                      <CheckIcon width={15} height={15} style={{ verticalAlign: "-3px" }} /> Bonne réponse
                    </>
                  ) : v.is_correct === false ? (
                    <>
                      <CloseIcon width={15} height={15} style={{ verticalAlign: "-3px" }} /> Réponse incorrecte
                    </>
                  ) : (
                    "Correction par l'enseignant"
                  )}
                </p>
              )}
              {v?.explanation && <p className={ui.hint} style={{ margin: 0 }}>{v.explanation}</p>}
            </li>
          );
        })}
      </ol>
      {canRetry && !attempt.passed && (
        <button type="button" className={cx(ui.button, ui.secondary)} style={{ alignSelf: "flex-start" }} onClick={onRetry}>
          <RefreshIcon />
          Nouvelle tentative
        </button>
      )}
    </>
  );
}

function Ordering({ choices, value, onChange, prompt }: { choices: Quiz["questions"][number]["choices"]; value: string[]; onChange: (v: string[]) => void; prompt: string }) {
  const order = value.length ? value : choices.map((c) => c.id);
  const move = (i: number, d: number) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <ol aria-label={`Ordre : ${prompt}`} style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
      {order.map((id, i) => {
        const c = choices.find((x) => x.id === id)!;
        return (
          <li key={id} className={styles.option} style={{ cursor: "default" }}>
            <span style={{ flex: 1 }}>{c.label}</span>
            <button type="button" className={ui.iconButton} style={{ width: 34, height: 34 }} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter « ${c.label} »`}>
              <ArrowUpIcon />
            </button>
            <button type="button" className={ui.iconButton} style={{ width: 34, height: 34 }} onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Descendre « ${c.label} »`}>
              <ArrowDownIcon />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Quiz inséré dans un chapitre : démarrer, répondre, voir la correction (jamais les bonnes réponses elles-mêmes). */
export function QuizRunner({ quizId, title }: { quizId: string; title?: string }) {
  const toast = useToast();
  const client = useQueryClient();
  const quiz = useQuiz(quizId);
  const attempts = useAttempts(quizId);
  const [running, setRunning] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);

  if (quiz.isPending || attempts.isPending) return <Skeleton height={140} radius={18} />;
  if (quiz.isError) {
    const code = quiz.error instanceof ApiError ? quiz.error.code : "";
    return (
      <div className={styles.quiz}>
        <p className={styles.quizTitle}>{title || "Quiz"}</p>
        <p className={ui.hint} style={{ margin: 0 }}>
          {code === "not_found" || code === "enroll_required" ? "Inscrivez-vous au cours pour faire ce quiz." : describeError(quiz.error)}
        </p>
      </div>
    );
  }
  const q = quiz.data;
  const list = attempts.data ?? [];
  const last = list[list.length - 1];
  const open = running ?? (last?.status === "in_progress" ? last : null);
  const remaining = q.max_attempts ? q.max_attempts - list.length : Infinity;

  const start = async () => {
    setBusy(true);
    try {
      const attempt = await learnApi.startAttempt(quizId);
      setRunning(attempt);
      setAnswers({});
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (final: Answers) => {
    if (!open) return;
    setBusy(true);
    try {
      await learnApi.submitAttempt(open.id, final);
      setRunning(null);
      await client.invalidateQueries({ queryKey: learnKeys.attempts(quizId) });
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const set = (id: string, value: { selected?: string[]; text?: string }) => setAnswers((a) => ({ ...a, [id]: value }));
  const unanswered = q.questions.filter((x) => {
    const a = answers[x.id];
    return x.kind === "ordering" ? false : x.kind === "text" || x.kind === "code" ? !a?.text?.trim() : !a?.selected?.length;
  }).length;

  return (
    <section className={styles.quiz} aria-label={`Quiz : ${q.title}`}>
      <div className={styles.quizHead}>
        <h3 className={styles.quizTitle}>
          <PollIcon width={18} height={18} style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--bb-blue-600)" }} aria-hidden="true" />
          {q.title}
        </h3>
        <span className={ui.hint} style={{ margin: 0 }}>
          {q.questions.length} question{q.questions.length > 1 ? "s" : ""} · réussite à {q.pass_percent}&nbsp;%
          {q.max_attempts ? ` · ${Math.max(0, remaining)} tentative${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {open ? (
        <>
          {q.questions.map((question, i) => (
            <fieldset key={question.id} className={styles.question}>
              <legend>
                {i + 1}. {question.prompt}
              </legend>
              {(question.kind === "single" || question.kind === "true_false") &&
                question.choices.map((c) => (
                  <label key={c.id} className={styles.option}>
                    <input type="radio" name={`q-${question.id}`} checked={answers[question.id]?.selected?.[0] === c.id} onChange={() => set(question.id, { selected: [c.id] })} />
                    {c.label}
                  </label>
                ))}
              {question.kind === "multiple" &&
                question.choices.map((c) => {
                  const selected = answers[question.id]?.selected ?? [];
                  return (
                    <label key={c.id} className={styles.option}>
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={(e) => set(question.id, { selected: e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id) })}
                      />
                      {c.label}
                    </label>
                  );
                })}
              {question.kind === "ordering" && (
                <Ordering choices={question.choices} prompt={question.prompt} value={answers[question.id]?.selected ?? []} onChange={(v) => set(question.id, { selected: v })} />
              )}
              {(question.kind === "text" || question.kind === "code") && (
                <textarea
                  className={ui.textarea}
                  style={question.kind === "code" ? { fontFamily: "ui-monospace, Menlo, Consolas, monospace", minHeight: 140 } : { minHeight: 70 }}
                  aria-label={`Réponse à la question ${i + 1}`}
                  spellCheck={question.kind !== "code"}
                  value={answers[question.id]?.text ?? ""}
                  onChange={(e) => set(question.id, { text: e.target.value })}
                />
              )}
            </fieldset>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className={cx(ui.button, ui.primary)}
              onClick={() => {
                // L'ordre par défaut d'une question de mise en ordre compte aussi comme une réponse.
                const final: Answers = { ...answers };
                for (const question of q.questions)
                  if (question.kind === "ordering" && !final[question.id]?.selected?.length) final[question.id] = { selected: question.choices.map((c) => c.id) };
                void submit(final);
              }}
              disabled={busy}
            >
              <CheckIcon />
              {busy ? "Correction…" : "Valider mes réponses"}
            </button>
            {unanswered > 0 && <span className={ui.hint} style={{ margin: 0 }}>{unanswered} question{unanswered > 1 ? "s" : ""} sans réponse</span>}
          </div>
        </>
      ) : last ? (
        <Result quiz={q} attempt={last} canRetry={remaining > 0} onRetry={start} />
      ) : (
        <button type="button" className={cx(ui.button, ui.primary)} style={{ alignSelf: "flex-start" }} onClick={start} disabled={busy || remaining <= 0}>
          <PollIcon />
          Commencer le quiz
        </button>
      )}
    </section>
  );
}
