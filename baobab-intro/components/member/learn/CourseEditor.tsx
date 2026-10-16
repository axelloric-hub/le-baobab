"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { learnApi } from "@/features/learn/api";
import { learnKeys, useCourseEditor, useQuizzes } from "@/features/learn/hooks";
import type { BlockKind, CourseLevel, CourseOutline } from "@/features/learn/types";
import { describeError } from "@/lib/api/errors";
import { toMinor } from "@/lib/money";
import { uploadFile } from "@/lib/uploads/upload";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { CheckIcon, FileIcon, PlusIcon, TrashIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { PriceField } from "./ClassroomDialogs";
import { BLOCK_KINDS, LANGUAGES, LEVELS } from "./labels";
import styles from "./Learn.module.css";

/* ------------------------------------------------------------------ */
/* Informations du cours                                               */
/* ------------------------------------------------------------------ */

export function EditCourseDialog({ course, open, onClose }: { course: CourseOutline; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { update } = useCourseEditor(course.id);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [level, setLevel] = useState<CourseLevel>(course.level);
  const [language, setLanguage] = useState(course.language);
  const [certificate, setCertificate] = useState(course.certificate_enabled);
  if (!open) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      busy={update.isPending}
      title="Modifier le cours"
      footer={
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          disabled={title.trim().length < 3 || update.isPending}
          onClick={() =>
            update.mutate(
              { title: title.trim(), description: description.trim(), level, language, certificate_enabled: certificate },
              {
                onSuccess: () => {
                  toast("Cours mis à jour.", { tone: "success" });
                  onClose();
                },
                onError: (e) => toast(describeError(e), { tone: "error" }),
              },
            )
          }
        >
          Enregistrer
        </button>
      }
    >
      <div className={layout.form}>
        <Field id="edit-course-title" label="Titre">
          <input id="edit-course-title" className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="edit-course-description" label="Description" optional>
          <textarea id="edit-course-description" className={ui.textarea} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
          <Field id="edit-course-level" label="Niveau">
            <select id="edit-course-level" className={ui.select} value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)}>
              {(Object.keys(LEVELS) as CourseLevel[]).map((l) => (
                <option key={l} value={l}>
                  {LEVELS[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="edit-course-language" label="Langue">
            <select id="edit-course-language" className={ui.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
          <input type="checkbox" checked={certificate} onChange={(e) => setCertificate(e.target.checked)} />
          Délivrer un certificat vérifiable à la fin du cours
        </label>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Module et chapitre                                                  */
/* ------------------------------------------------------------------ */

export function AddModuleDialog({ courseId, open, onClose }: { courseId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { addModule } = useCourseEditor(courseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [free, setFree] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XAF");
  if (!open) return null;
  const price = free ? null : toMinor(amount, currency);
  return (
    <Dialog
      open
      onClose={onClose}
      busy={addModule.isPending}
      title="Ajouter un module"
      footer={
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          disabled={title.trim().length < 2 || (!free && !price) || addModule.isPending}
          onClick={() =>
            addModule.mutate(
              { title: title.trim(), description: description.trim(), is_free: free, price_minor: price, currency: free ? "" : currency },
              {
                onSuccess: () => {
                  toast("Module ajouté.", { tone: "success" });
                  setTitle("");
                  setDescription("");
                  onClose();
                },
                onError: (e) => toast(describeError(e), { tone: "error" }),
              },
            )
          }
        >
          Ajouter
        </button>
      }
    >
      <div className={layout.form}>
        <Field id="module-title" label="Titre du module" hint="Par exemple : Les bases, Les modèles, Déployer en production">
          <input id="module-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="module-description" label="Description" optional>
          <textarea id="module-description" className={ui.textarea} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <PriceField id="module-price" free={free} setFree={setFree} amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} label="Accès au module" />
        {!free && <p className={ui.hint}>Un module payant doit contenir au moins un chapitre payant pour que le cours puisse être publié.</p>}
      </div>
    </Dialog>
  );
}

export function AddChapterDialog({ courseId, moduleId, open, onClose }: { courseId: string; moduleId: string | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { addChapter } = useCourseEditor(courseId);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [free, setFree] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XAF");
  if (!open || !moduleId) return null;
  const price = free ? null : toMinor(amount, currency);
  const m = Number(minutes);
  return (
    <Dialog
      open
      onClose={onClose}
      busy={addChapter.isPending}
      title="Ajouter un chapitre"
      footer={
        <button
          type="button"
          className={cx(ui.button, ui.primary)}
          disabled={title.trim().length < 2 || !(m >= 1 && m <= 600) || (!free && !price) || addChapter.isPending}
          onClick={() =>
            addChapter.mutate(
              { moduleId, input: { title: title.trim(), estimated_minutes: m, is_free: free, price_minor: price, currency: free ? "" : currency } },
              {
                onSuccess: () => {
                  toast("Chapitre ajouté : ouvrez-le pour y mettre du contenu.", { tone: "success" });
                  setTitle("");
                  onClose();
                },
                onError: (e) => toast(describeError(e), { tone: "error" }),
              },
            )
          }
        >
          Ajouter
        </button>
      }
    >
      <div className={layout.form}>
        <Field id="chapter-title" label="Titre du chapitre">
          <input id="chapter-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="chapter-minutes" label="Durée estimée (minutes)">
          <input id="chapter-minutes" className={ui.input} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <PriceField id="chapter-price" free={free} setFree={setFree} amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} label="Accès au chapitre" />
        {free && <p className={ui.hint}>Un chapitre gratuit d&apos;une classe publique sert d&apos;aperçu : il est lisible sans inscription.</p>}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

type DraftQuestion = { kind: "single" | "multiple" | "true_false" | "text"; prompt: string; choices: Array<{ label: string; correct: boolean }>; accepted: string; explanation: string };

const emptyQuestion = (): DraftQuestion => ({ kind: "single", prompt: "", choices: [{ label: "", correct: true }, { label: "", correct: false }], accepted: "", explanation: "" });

function questionProblem(q: DraftQuestion): string | null {
  if (!q.prompt.trim()) return "Écrivez l'énoncé.";
  if (q.kind === "text") return q.accepted.split("\n").some((a) => a.trim()) ? null : "Ajoutez au moins une réponse acceptée.";
  const filled = q.choices.filter((c) => c.label.trim());
  if (filled.length < 2) return "Ajoutez au moins deux choix.";
  const right = filled.filter((c) => c.correct).length;
  if (right === 0) return "Cochez la bonne réponse.";
  if (q.kind !== "multiple" && right !== 1) return "Une seule bonne réponse pour ce type de question.";
  return null;
}

/** Crée un quiz, ses questions, le publie, puis l'insère dans le chapitre (bloc « quiz »). */
export function QuizBuilderDialog({ courseId, chapterId, open, onClose }: { courseId: string; chapterId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [pass, setPass] = useState("60");
  const [attempts, setAttempts] = useState("3");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const problems = questions.map(questionProblem);
  const ready = title.trim().length >= 2 && problems.every((p) => !p);

  const patch = (i: number, update: Partial<DraftQuestion>) => setQuestions((list) => list.map((q, j) => (j === i ? { ...q, ...update } : q)));

  const save = async () => {
    setSaving(true);
    try {
      const quiz = await learnApi.createQuiz(courseId, { title: title.trim(), pass_percent: Number(pass) || 60, max_attempts: Number(attempts) || 0, chapter: chapterId });
      for (const q of questions) {
        const base = { kind: q.kind, prompt: q.prompt.trim(), points: 1, explanation: q.explanation.trim() };
        if (q.kind === "text") await learnApi.addQuestion(quiz.id, { ...base, accepted: q.accepted.split("\n").map((a) => a.trim()).filter(Boolean) });
        else await learnApi.addQuestion(quiz.id, { ...base, choices: q.choices.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), is_correct: c.correct })) });
      }
      await learnApi.publishQuiz(quiz.id, true);
      await learnApi.addBlock(chapterId, { kind: "quiz", title: title.trim(), ref_id: quiz.id });
      void client.invalidateQueries({ queryKey: learnKeys.chapter(chapterId) });
      void client.invalidateQueries({ queryKey: learnKeys.quizzes(courseId) });
      toast("Quiz ajouté au chapitre.", { tone: "success" });
      setQuestions([emptyQuestion()]);
      setTitle("");
      onClose();
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      size="lg"
      title="Créer un quiz"
      footer={
        <>
          <span className={ui.hint} style={{ marginRight: "auto", marginTop: 0 }}>
            {problems.find(Boolean) ?? (title.trim() ? "" : "Donnez un titre au quiz.")}
          </span>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={save} disabled={!ready || saving}>
            {saving ? "Enregistrement…" : "Ajouter le quiz"}
          </button>
        </>
      }
    >
      <div className={layout.form}>
        <Field id="quiz-title" label="Titre du quiz">
          <input id="quiz-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vérifiez vos acquis" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field id="quiz-pass" label="Réussite à (%)">
            <input id="quiz-pass" className={ui.input} inputMode="numeric" value={pass} onChange={(e) => setPass(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </Field>
          <Field id="quiz-attempts" label="Tentatives (0 = illimité)">
            <input id="quiz-attempts" className={ui.input} inputMode="numeric" value={attempts} onChange={(e) => setAttempts(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
        </div>
        {questions.map((q, i) => (
          <fieldset key={i} className={styles.question} style={{ background: "var(--bb-surface-warm)" }}>
            <legend>Question {i + 1}</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Type de question">
              {(
                [
                  ["single", "Choix unique"],
                  ["multiple", "Choix multiple"],
                  ["true_false", "Vrai / Faux"],
                  ["text", "Réponse libre"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className={cx(ui.chip, ui.small)}
                  aria-pressed={q.kind === kind}
                  onClick={() => patch(i, { kind, choices: kind === "true_false" ? [{ label: "Vrai", correct: true }, { label: "Faux", correct: false }] : q.kind === "true_false" ? emptyQuestion().choices : q.choices })}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea className={ui.textarea} style={{ minHeight: 70 }} aria-label={`Énoncé de la question ${i + 1}`} placeholder="Énoncé" value={q.prompt} onChange={(e) => patch(i, { prompt: e.target.value })} />
            {q.kind === "text" ? (
              <textarea
                className={ui.textarea}
                style={{ minHeight: 60 }}
                aria-label="Réponses acceptées"
                placeholder="Réponses acceptées, une par ligne (la casse et les accents sont ignorés)"
                value={q.accepted}
                onChange={(e) => patch(i, { accepted: e.target.value })}
              />
            ) : (
              <div className={layout.stack} style={{ gap: 6 }}>
                {q.choices.map((choice, j) => (
                  <div key={j} className={styles.choiceRow}>
                    <input
                      type={q.kind === "multiple" ? "checkbox" : "radio"}
                      name={`q${i}-correct`}
                      checked={choice.correct}
                      aria-label={`Choix ${j + 1} correct`}
                      onChange={(e) =>
                        patch(i, { choices: q.choices.map((c, k) => (q.kind === "multiple" ? (k === j ? { ...c, correct: e.target.checked } : c) : { ...c, correct: k === j })) })
                      }
                    />
                    <input
                      className={ui.input}
                      aria-label={`Choix ${j + 1}`}
                      placeholder={`Choix ${j + 1}`}
                      value={choice.label}
                      readOnly={q.kind === "true_false"}
                      onChange={(e) => patch(i, { choices: q.choices.map((c, k) => (k === j ? { ...c, label: e.target.value } : c)) })}
                    />
                    {q.kind !== "true_false" && q.choices.length > 2 ? (
                      <button type="button" className={ui.iconButton} aria-label={`Retirer le choix ${j + 1}`} onClick={() => patch(i, { choices: q.choices.filter((_, k) => k !== j) })}>
                        <TrashIcon />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                {q.kind !== "true_false" && q.choices.length < 8 && (
                  <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => patch(i, { choices: [...q.choices, { label: "", correct: false }] })}>
                    <PlusIcon />
                    Ajouter un choix
                  </button>
                )}
              </div>
            )}
            <input className={ui.input} aria-label="Explication" placeholder="Explication affichée après la réponse (facultatif)" value={q.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} />
            {questions.length > 1 && (
              <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => setQuestions((list) => list.filter((_, k) => k !== i))}>
                <TrashIcon />
                Retirer la question
              </button>
            )}
          </fieldset>
        ))}
        <button type="button" className={cx(ui.button, ui.secondary)} style={{ alignSelf: "flex-start" }} onClick={() => setQuestions((list) => [...list, emptyQuestion()])}>
          <PlusIcon />
          Ajouter une question
        </button>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Bloc de contenu                                                     */
/* ------------------------------------------------------------------ */

const FILE_KINDS: BlockKind[] = ["image", "pdf", "document", "presentation", "notebook", "audio"];
const ACCEPT: Partial<Record<BlockKind, string>> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  pdf: "application/pdf",
  audio: "audio/mpeg,audio/ogg,audio/wav",
  video: "video/mp4,video/webm",
  notebook: ".ipynb,application/x-ipynb+json",
  document: "application/pdf",
  presentation: "application/pdf",
};

export function AddBlockDialog({ courseId, chapterId, open, onClose, onQuiz }: { courseId: string; chapterId: string; open: boolean; onClose: () => void; onQuiz: () => void }) {
  const toast = useToast();
  const { addBlock } = useCourseEditor(courseId);
  const quizzes = useQuizzes(courseId, open);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<BlockKind>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState("python");
  const [url, setUrl] = useState("");
  const [videoSource, setVideoSource] = useState<"youtube" | "file">("youtube");
  const [file, setFile] = useState<{ name: string; id?: string; progress: number; error?: string } | null>(null);
  const [quiz, setQuiz] = useState("");
  if (!open) return null;

  const usesFile = FILE_KINDS.includes(kind) || (kind === "video" && videoSource === "file");
  const usesUrl = kind === "link" || kind === "repository" || (kind === "video" && videoSource === "youtube");
  const missing =
    (kind === "text" || kind === "code") && !body.trim()
      ? "Écrivez le contenu."
      : usesUrl && !/^https:\/\/\S+/.test(url.trim())
        ? "Collez une adresse https://"
        : usesFile && !file?.id
          ? "Choisissez un fichier."
          : kind === "quiz" && !quiz
            ? "Choisissez un quiz."
            : null;

  const pick = async (f: File) => {
    setFile({ name: f.name, progress: 0 });
    try {
      const id = await uploadFile(f, "course_content", { onProgress: (progress) => setFile((x) => (x ? { ...x, progress } : x)) });
      setFile({ name: f.name, id, progress: 1 });
    } catch (error) {
      setFile({ name: f.name, progress: 0, error: describeError(error) });
    }
  };

  const save = () => {
    if (missing) return;
    const input: Parameters<typeof learnApi.addBlock>[1] = { kind, title: title.trim() };
    if (kind === "text") input.body = body;
    if (kind === "code") Object.assign(input, { body, payload: { language } });
    if (usesUrl) input.url = url.trim();
    if (usesFile) input.file = file!.id;
    if (kind === "quiz") input.ref_id = quiz;
    addBlock.mutate(
      { chapterId, input },
      {
        onSuccess: () => {
          toast("Contenu ajouté.", { tone: "success" });
          setBody("");
          setUrl("");
          setTitle("");
          setFile(null);
          onClose();
        },
        onError: (e) => toast(describeError(e), { tone: "error" }),
      },
    );
  };

  const kinds: BlockKind[] = ["text", "code", "video", "image", "pdf", "audio", "link", "repository", "quiz"];
  return (
    <Dialog
      open
      onClose={onClose}
      busy={addBlock.isPending}
      size="lg"
      title="Ajouter du contenu"
      footer={
        <>
          <span className={ui.hint} style={{ marginRight: "auto", marginTop: 0 }}>
            {missing ?? ""}
          </span>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={save} disabled={Boolean(missing) || addBlock.isPending}>
            Ajouter
          </button>
        </>
      }
    >
      <div className={layout.form}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Type de contenu">
          {kinds.map((k) => (
            <button key={k} type="button" className={cx(ui.chip, ui.small)} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {BLOCK_KINDS[k]}
            </button>
          ))}
        </div>
        {kind !== "quiz" && (
          <Field id="block-title" label="Titre du bloc" optional>
            <input id="block-title" className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        )}
        {kind === "text" && (
          <Field id="block-body" label="Texte" hint="Titres avec ## , listes avec - , code entre `accents graves`, blocs de code entre ``` , **gras**, _italique_, liens https://…">
            <textarea id="block-body" className={ui.textarea} style={{ minHeight: 220, fontFamily: "inherit" }} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        )}
        {kind === "code" && (
          <>
            <Field id="block-language" label="Langage">
              <select id="block-language" className={ui.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {["python", "javascript", "typescript", "java", "kotlin", "dart", "php", "go", "rust", "c", "cpp", "csharp", "sql", "bash", "html", "css", "json", "yaml"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="block-code" label="Code">
              <textarea id="block-code" className={ui.textarea} style={{ minHeight: 200, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 14 }} spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
          </>
        )}
        {kind === "video" && (
          <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Source de la vidéo">
            <button type="button" className={cx(ui.chip, ui.small)} aria-pressed={videoSource === "youtube"} onClick={() => setVideoSource("youtube")}>
              Lien YouTube
            </button>
            <button type="button" className={cx(ui.chip, ui.small)} aria-pressed={videoSource === "file"} onClick={() => setVideoSource("file")}>
              Fichier vidéo
            </button>
          </div>
        )}
        {usesUrl && (
          <Field
            id="block-url"
            label={kind === "repository" ? "Adresse du dépôt GitHub" : kind === "video" ? "Adresse de la vidéo YouTube" : "Adresse"}
            hint={kind === "repository" ? "Un dépôt public : github.com/propriétaire/dépôt" : kind === "video" ? "La vidéo est lue dans LE BAOBAB, sans quitter le cours." : undefined}
          >
            <input id="block-url" className={ui.input} type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        )}
        {usesFile && (
          <div>
            <span className={ui.label}>Fichier</span>
            {file ? (
              <div className={styles.fileCard}>
                <span className={styles.fileIcon}>
                  <FileIcon />
                </span>
                <span className={styles.fileText}>
                  <strong>{file.name}</strong>
                  <small>{file.error ? file.error : file.id ? "Envoyé" : `Envoi… ${Math.round(file.progress * 100)} %`}</small>
                </span>
                {file.id && <CheckIcon width={20} height={20} style={{ color: "#16a34a" }} />}
                <button type="button" className={ui.iconButton} aria-label="Retirer le fichier" onClick={() => setFile(null)}>
                  <TrashIcon />
                </button>
              </div>
            ) : (
              <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => fileRef.current?.click()}>
                <FileIcon />
                Choisir un fichier
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={ACCEPT[kind]}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void pick(f);
              }}
            />
          </div>
        )}
        {kind === "quiz" && (
          <div className={layout.stack} style={{ gap: 10 }}>
            {quizzes.data && quizzes.data.filter((q) => q.is_published).length > 0 && (
              <Field id="block-quiz" label="Quiz existant">
                <select id="block-quiz" className={ui.select} value={quiz} onChange={(e) => setQuiz(e.target.value)}>
                  <option value="">Choisir…</option>
                  {quizzes.data
                    .filter((q) => q.is_published)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.questions} question{q.questions > 1 ? "s" : ""})
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <button
              type="button"
              className={cx(ui.button, ui.secondary)}
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                onClose();
                onQuiz();
              }}
            >
              <PlusIcon />
              Créer un nouveau quiz
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Devoir                                                              */
/* ------------------------------------------------------------------ */

export function AssignmentDialog({ courseId, open, onClose }: { courseId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [points, setPoints] = useState("20");
  const [due, setDue] = useState("");
  const [late, setLate] = useState(true);
  const [attempts, setAttempts] = useState("1");
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const ready = title.trim().length >= 2 && Number(points) >= 1;
  const save = async () => {
    setSaving(true);
    try {
      await learnApi.createAssignment(courseId, {
        title: title.trim(),
        instructions: instructions.trim(),
        max_points: Number(points),
        due_at: due ? new Date(`${due}T23:59:00`).toISOString() : undefined,
        allow_late: late,
        max_attempts: Number(attempts) || 1,
      });
      void client.invalidateQueries({ queryKey: learnKeys.assignments(courseId) });
      toast("Devoir publié pour les élèves inscrits.", { tone: "success" });
      onClose();
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      title="Créer un devoir"
      footer={
        <button type="button" className={cx(ui.button, ui.primary)} onClick={save} disabled={!ready || saving}>
          Publier le devoir
        </button>
      }
    >
      <div className={layout.form}>
        <Field id="assignment-title" label="Titre">
          <input id="assignment-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="assignment-instructions" label="Consignes">
          <textarea id="assignment-instructions" className={ui.textarea} style={{ minHeight: 160 }} maxLength={20000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12 }}>
          <Field id="assignment-points" label="Noté sur">
            <input id="assignment-points" className={ui.input} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </Field>
          <Field id="assignment-attempts" label="Rendus autorisés">
            <input id="assignment-attempts" className={ui.input} inputMode="numeric" value={attempts} onChange={(e) => setAttempts(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
          <Field id="assignment-due" label="À rendre avant le" optional>
            <input id="assignment-due" type="date" className={ui.input} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
          <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} />
          Accepter les rendus en retard (ils sont signalés)
        </label>
      </div>
    </Dialog>
  );
}
