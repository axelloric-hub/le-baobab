"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMe, useMyGroups } from "@/features/me/me";
import type { CreatePostInput } from "@/features/social/api";
import { useCreatePost } from "@/features/social/hooks";
import { safeUrl } from "@/features/social/payload";
import type { UserBrief, Visibility } from "@/features/social/types";
import { describeError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import type { ComposerTool } from "../shell/creation-context";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { AudioIcon, ChevronDownIcon, CloseIcon, CodeIcon, FileIcon, ImageIcon, LinkIcon, PlusIcon, PollIcon, ProjectIcon, TrashIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { visibilityOf } from "../ui/visibility";
import { AudiencePicker } from "./AudiencePicker";
import styles from "./Composer.module.css";
import { ACCEPT, useUploads } from "./use-uploads";
import { VisibilityPicker } from "./VisibilityPicker";

const BODY_MAX = 20000;
const DRAFT_KEY = "baobab.draft.post.v1";
const LANGUAGES = [
  "python", "javascript", "typescript", "java", "kotlin", "swift", "go", "rust", "php", "ruby", "c", "cpp", "csharp", "dart", "sql", "bash", "html", "css", "json", "yaml",
];
const POLL_DURATIONS = [
  { value: "", label: "Sans date de fin" },
  { value: "1", label: "1 jour" },
  { value: "3", label: "3 jours" },
  { value: "7", label: "7 jours" },
];

interface Draft {
  body: string;
  tool: ComposerTool | null;
  code: { language: string; filename: string; code: string };
  link: string;
  poll: { question: string; options: string[]; multiple: boolean; days: string };
  project: { name: string; description: string; technologies: string[]; url: string; repository_url: string };
}

const EMPTY: Draft = {
  body: "",
  tool: null,
  code: { language: "python", filename: "", code: "" },
  link: "",
  poll: { question: "", options: ["", ""], multiple: false, days: "" },
  project: { name: "", description: "", technologies: [], url: "", repository_url: "" },
};

function readDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (!draft || JSON.stringify(draft) === JSON.stringify(EMPTY)) window.localStorage.removeItem(DRAFT_KEY);
    else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* stockage indisponible : pas de brouillon */
  }
}

/** Texte avec #hashtags et @mentions colorés (couche miroir derrière la zone de saisie). */
function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(?<![\w#])#[A-Za-z0-9_À-ɏ]{2,50}|(?<![\w@])@[a-z0-9][a-z0-9_.]{2,29}/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    out.push(text.slice(last, index), <mark key={index}>{match[0]}</mark>);
    last = index + match[0].length;
  }
  out.push(text.slice(last), "​");
  return out;
}

const TOOLS: Array<{ tool: ComposerTool; label: string; Icon: typeof ImageIcon }> = [
  { tool: "media", label: "Photos, vidéos ou fichiers", Icon: ImageIcon },
  { tool: "code", label: "Extrait de code", Icon: CodeIcon },
  { tool: "poll", label: "Sondage", Icon: PollIcon },
  { tool: "project", label: "Projet", Icon: ProjectIcon },
  { tool: "link", label: "Lien", Icon: LinkIcon },
];

export function PostComposer({ open, tool, onClose }: { open: boolean; tool?: ComposerTool; onClose: () => void }) {
  return open ? <ComposerDialog initialTool={tool} onClose={onClose} /> : null;
}

function ComposerDialog({ initialTool, onClose }: { initialTool?: ComposerTool; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const create = useCreatePost();
  const uploads = useUploads("post_media", 10);
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readDraft();
    return initialTool ? { ...saved, tool: initialTool } : saved;
  });
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [audience, setAudience] = useState<UserBrief[]>([]);
  const [group, setGroup] = useState("");
  const [techInput, setTechInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const groups = useMyGroups(true);

  const effectiveVisibility = visibility ?? me.data?.privacy.default_post_visibility ?? "public";
  const vis = visibilityOf(effectiveVisibility);
  const name = me.data?.display_name || me.data?.username || currentUser()?.username || "";

  // Brouillon : sauvegarde locale à chaque modification (léger différé).
  useEffect(() => {
    const timer = window.setTimeout(() => writeDraft(draft), 400);
    return () => window.clearTimeout(timer);
  }, [draft]);

  // Hauteur automatique de la zone de texte.
  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [draft.body]);

  useEffect(() => {
    if (initialTool === "media") fileRef.current?.click();
    else textRef.current?.focus();
  }, [initialTool]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setTool = (next: ComposerTool) => {
    if (next === "media") {
      // Les fichiers se combinent avec un code, un sondage, un projet ou un lien.
      if (!draft.tool) set("tool", "media");
      fileRef.current?.click();
      return;
    }
    set("tool", draft.tool === next ? null : next);
  };

  const showMedia = draft.tool === "media" || uploads.items.length > 0;
  const kindTool = draft.tool && draft.tool !== "media" ? draft.tool : null;

  /** Ce qui manque pour publier (null = prêt). */
  const blocker = useMemo(() => {
    if (draft.body.length > BODY_MAX) return "Le texte est trop long.";
    if (uploads.busy) return "Envoi des fichiers en cours…";
    if (uploads.failed) return "Retirez les fichiers en erreur.";
    if (effectiveVisibility === "group_members" && !group) return "Choisissez le groupe.";
    if (effectiveVisibility === "custom" && audience.length === 0) return "Choisissez au moins une personne.";
    switch (kindTool) {
      case "code":
        return draft.code.code.trim() ? null : "Ajoutez votre code.";
      case "link":
        return safeUrl(draft.link) ? null : "Saisissez une adresse web valide (https://…).";
      case "poll": {
        const options = draft.poll.options.map((o) => o.trim()).filter(Boolean);
        if (!draft.poll.question.trim()) return "Posez la question du sondage.";
        if (options.length < 2) return "Ajoutez au moins deux choix.";
        if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return "Deux choix sont identiques.";
        return null;
      }
      case "project":
        return draft.project.name.trim() ? null : "Donnez un nom au projet.";
      default:
        return draft.body.trim() || uploads.items.length > 0 ? null : "Écrivez quelque chose ou ajoutez un fichier.";
    }
  }, [draft, uploads, effectiveVisibility, group, audience, kindTool]);

  const submit = () => {
    if (blocker || create.isPending) return;
    setError(null);
    const media = uploads.items.filter((i) => i.fileId).map((i) => ({ file: i.fileId!, alt: i.alt.trim() }));
    const input: CreatePostInput = { kind: "text", body: draft.body.trim(), visibility: effectiveVisibility, media };
    if (effectiveVisibility === "group_members") input.group = group;
    if (effectiveVisibility === "custom") input.audience = audience.map((u) => u.username);
    switch (kindTool) {
      case "code":
        input.kind = "code";
        input.payload = { language: draft.code.language, filename: draft.code.filename.trim() || undefined, code: draft.code.code.replace(/\s+$/, "") };
        break;
      case "link":
        input.kind = "link";
        input.payload = { url: safeUrl(draft.link) };
        break;
      case "poll": {
        input.kind = "poll";
        const poll: NonNullable<CreatePostInput["poll"]> = {
          question: draft.poll.question.trim(),
          options: draft.poll.options.map((o) => o.trim()).filter(Boolean),
          allows_multiple: draft.poll.multiple,
        };
        if (draft.poll.days) poll.closes_at = new Date(Date.now() + Number(draft.poll.days) * 86_400_000).toISOString();
        input.poll = poll;
        break;
      }
      case "project":
        input.kind = "project";
        input.payload = {
          name: draft.project.name.trim(),
          description: draft.project.description.trim() || undefined,
          technologies: draft.project.technologies,
          url: safeUrl(draft.project.url) ?? undefined,
          repository_url: safeUrl(draft.project.repository_url) ?? undefined,
        };
        break;
      default:
        if (media.length > 0) input.kind = uploads.items.some((i) => i.kind === "video") ? "video" : uploads.items.every((i) => i.kind === "image") ? "image" : "text";
    }
    create.mutate(input, {
      onSuccess: (post) => {
        writeDraft(null);
        uploads.reset();
        onClose();
        toast("Publication publiée.", { tone: "success", action: { label: "Voir", onClick: () => router.push(ROUTES.post(post.id)) } });
      },
      onError: (err) => setError(describeError(err)),
    });
  };

  const addTech = () => {
    const value = techInput.trim().replace(/,$/, "");
    if (value && !draft.project.technologies.includes(value) && draft.project.technologies.length < 8) {
      set("project", { ...draft.project, technologies: [...draft.project.technologies, value] });
    }
    setTechInput("");
  };

  const toolPanel = (title: string, Icon: typeof ImageIcon, children: ReactNode, onRemove: () => void) => (
    <section className={styles.toolPanel} aria-label={title}>
      <div className={styles.toolPanelHead}>
        <h3 className={styles.toolPanelTitle}>
          <Icon aria-hidden="true" />
          {title}
        </h3>
        <button type="button" className={ui.iconButton} onClick={onRemove} aria-label={`Retirer : ${title}`} style={{ width: 34, height: 34 }}>
          <CloseIcon />
        </button>
      </div>
      {children}
    </section>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      size="lg"
      title="Créer une publication"
      footer={
        <>
          <span className={styles.footerNote} aria-live="polite">
            {blocker && (draft.body || uploads.items.length || kindTool) ? blocker : "Brouillon enregistré sur cet appareil"}
          </span>
          <button type="button" className={cx(ui.button, ui.ghost)} onClick={onClose} disabled={create.isPending}>
            Plus tard
          </button>
          <button type="button" className={cx(ui.button, ui.primary)} onClick={submit} disabled={Boolean(blocker) || create.isPending} aria-describedby={error ? "composer-error" : undefined}>
            {create.isPending ? "Publication…" : "Publier"}
          </button>
        </>
      }
    >
      <div className={styles.authorRow}>
        <Avatar name={name || "?"} src={me.data?.avatar_url} size={48} />
        <div className={styles.authorText}>
          <span className={styles.authorName}>{name}</span>
          <button type="button" className={styles.audienceButton} aria-expanded={audienceOpen} onClick={() => setAudienceOpen((v) => !v)}>
            <vis.Icon aria-hidden="true" />
            {vis.label}
            {effectiveVisibility === "group_members" && group && ` · ${groups.data?.find((g) => g.slug === group)?.name ?? ""}`}
            <ChevronDownIcon aria-hidden="true" />
          </button>
        </div>
      </div>

      {audienceOpen && (
        <div className={styles.panel}>
          <div className={styles.stack}>
            <VisibilityPicker value={effectiveVisibility} onChange={setVisibility} legend="Qui peut voir cette publication ?" />
            {effectiveVisibility === "group_members" &&
              (groups.data && groups.data.length > 0 ? (
                <div>
                  <label className={ui.label} htmlFor="composer-group">
                    Groupe
                  </label>
                  <select id="composer-group" className={ui.select} value={group} onChange={(e) => setGroup(e.target.value)}>
                    <option value="">Choisir un groupe…</option>
                    {groups.data.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className={ui.hint}>Vous n&apos;êtes membre d&apos;aucun groupe pour l&apos;instant.</p>
              ))}
            {effectiveVisibility === "custom" && <AudiencePicker value={audience} onChange={setAudience} />}
          </div>
        </div>
      )}

      <div className={styles.editor}>
        <div className={styles.editorMirror} aria-hidden="true">
          {highlight(draft.body)}
        </div>
        <label htmlFor="composer-body" className="bb-visually-hidden">
          Texte de la publication
        </label>
        <textarea
          id="composer-body"
          ref={textRef}
          className={styles.editorInput}
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder={
            kindTool === "code"
              ? "Expliquez votre code en quelques mots…"
              : kindTool === "poll"
                ? "Donnez un peu de contexte à votre sondage (facultatif)…"
                : "De quoi voulez-vous parler ? Utilisez #hashtags et @mentions."
          }
          rows={4}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        />
      </div>
      {draft.body.length > BODY_MAX * 0.9 && (
        <p className={styles.counter} data-over={draft.body.length > BODY_MAX || undefined}>
          {draft.body.length.toLocaleString("fr")} / {BODY_MAX.toLocaleString("fr")}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT.post_media}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void uploads.add(e.target.files);
          e.target.value = "";
        }}
      />

      {showMedia &&
        toolPanel(
          "Photos, vidéos et fichiers",
          ImageIcon,
          <>
            {uploads.items.length < 10 && (
              <button
                type="button"
                className={styles.drop}
                data-over={dragOver || undefined}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) void uploads.add(e.dataTransfer.files);
                }}
              >
                <PlusIcon aria-hidden="true" />
                <strong>Ajouter des fichiers</strong>
                <small>Images, vidéos MP4/WebM, audio ou PDF · 100&nbsp;Mo maximum · 10 fichiers</small>
              </button>
            )}
            {uploads.items.length > 0 && (
              <ul className={styles.files}>
                {uploads.items.map((item) => (
                  <li key={item.key} className={styles.fileItem}>
                    <div className={styles.thumb}>
                      {item.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
                        <img src={item.preview} alt="" />
                      ) : item.kind === "video" ? (
                        <video src={item.preview} muted playsInline preload="metadata" />
                      ) : item.kind === "audio" ? (
                        <AudioIcon aria-hidden="true" />
                      ) : (
                        <FileIcon aria-hidden="true" />
                      )}
                      <span className={styles.fileState} data-tone={item.error ? "error" : item.fileId ? "done" : undefined}>
                        {item.error ? "Erreur" : item.fileId ? "Prêt" : `${Math.round(item.progress * 100)} %`}
                      </span>
                      {!item.fileId && !item.error && (
                        <span className={styles.fileProgress} role="progressbar" aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Envoi de ${item.file.name}`}>
                          <span style={{ width: `${item.progress * 100}%` }} />
                        </span>
                      )}
                      <button type="button" className={styles.fileRemove} onClick={() => uploads.remove(item.key)} aria-label={`Retirer ${item.file.name}`}>
                        <TrashIcon />
                      </button>
                    </div>
                    {item.error ? (
                      <p className={styles.fileError}>{item.error}</p>
                    ) : (
                      <input
                        className={styles.alt}
                        placeholder={item.kind === "image" ? "Description de l'image" : "Titre (facultatif)"}
                        aria-label={`Description de ${item.file.name}`}
                        maxLength={300}
                        value={item.alt}
                        onChange={(e) => uploads.setAlt(item.key, e.target.value)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>,
          () => {
            uploads.reset();
            if (draft.tool === "media") set("tool", null);
          },
        )}

      {kindTool === "code" &&
        toolPanel(
          "Extrait de code",
          CodeIcon,
          <div className={styles.stack}>
            <div className={styles.row}>
              <div>
                <label className={ui.label} htmlFor="code-language">
                  Langage
                </label>
                <select id="code-language" className={ui.select} value={draft.code.language} onChange={(e) => set("code", { ...draft.code, language: e.target.value })}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  <option value="">autre</option>
                </select>
              </div>
              <div>
                <label className={ui.label} htmlFor="code-filename">
                  Nom du fichier (facultatif)
                </label>
                <input
                  id="code-filename"
                  className={ui.input}
                  placeholder="ex. : webhooks.py"
                  maxLength={120}
                  value={draft.code.filename}
                  onChange={(e) => set("code", { ...draft.code, filename: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={ui.label} htmlFor="code-body">
                Code
              </label>
              <textarea
                id="code-body"
                className={cx(ui.textarea, styles.code)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                value={draft.code.code}
                onChange={(e) => set("code", { ...draft.code, code: e.target.value })}
                onKeyDown={(e) => {
                  // Tabulation insérée dans le code (Échap puis Tab pour quitter le champ au clavier).
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    const t = e.currentTarget;
                    const { selectionStart: s, selectionEnd: end } = t;
                    const next = `${t.value.slice(0, s)}  ${t.value.slice(end)}`;
                    set("code", { ...draft.code, code: next });
                    requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
                  }
                }}
              />
            </div>
          </div>,
          () => set("tool", null),
        )}

      {kindTool === "link" &&
        toolPanel(
          "Lien",
          LinkIcon,
          <div>
            <label className={ui.label} htmlFor="link-url">
              Adresse
            </label>
            <input id="link-url" className={ui.input} type="url" inputMode="url" placeholder="https://" value={draft.link} onChange={(e) => set("link", e.target.value)} />
          </div>,
          () => set("tool", null),
        )}

      {kindTool === "poll" &&
        toolPanel(
          "Sondage",
          PollIcon,
          <div className={styles.stack}>
            <div>
              <label className={ui.label} htmlFor="poll-question">
                Question
              </label>
              <input
                id="poll-question"
                className={ui.input}
                maxLength={300}
                placeholder="ex. : Quel framework backend utilisez-vous ?"
                value={draft.poll.question}
                onChange={(e) => set("poll", { ...draft.poll, question: e.target.value })}
              />
            </div>
            <fieldset style={{ margin: 0, padding: 0, border: 0 }} className={styles.stack}>
              <legend className={ui.label}>Choix (2 à 10)</legend>
              {draft.poll.options.map((option, index) => (
                <div key={index} className={styles.optionRow}>
                  <input
                    className={ui.input}
                    maxLength={120}
                    aria-label={`Choix ${index + 1}`}
                    placeholder={`Choix ${index + 1}`}
                    value={option}
                    onChange={(e) => set("poll", { ...draft.poll, options: draft.poll.options.map((o, i) => (i === index ? e.target.value : o)) })}
                  />
                  {draft.poll.options.length > 2 && (
                    <button
                      type="button"
                      className={ui.iconButton}
                      aria-label={`Supprimer le choix ${index + 1}`}
                      onClick={() => set("poll", { ...draft.poll, options: draft.poll.options.filter((_, i) => i !== index) })}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              ))}
              {draft.poll.options.length < 10 && (
                <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => set("poll", { ...draft.poll, options: [...draft.poll.options, ""] })}>
                  <PlusIcon />
                  Ajouter un choix
                </button>
              )}
            </fieldset>
            <div className={styles.row}>
              <label className={styles.check}>
                <input type="checkbox" checked={draft.poll.multiple} onChange={(e) => set("poll", { ...draft.poll, multiple: e.target.checked })} />
                Plusieurs réponses possibles
              </label>
              <div>
                <label className="bb-visually-hidden" htmlFor="poll-duration">
                  Durée du sondage
                </label>
                <select id="poll-duration" className={ui.select} value={draft.poll.days} onChange={(e) => set("poll", { ...draft.poll, days: e.target.value })}>
                  {POLL_DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>,
          () => set("tool", null),
        )}

      {kindTool === "project" &&
        toolPanel(
          "Projet",
          ProjectIcon,
          <div className={styles.stack}>
            <div>
              <label className={ui.label} htmlFor="project-name">
                Nom du projet
              </label>
              <input id="project-name" className={ui.input} maxLength={120} value={draft.project.name} onChange={(e) => set("project", { ...draft.project, name: e.target.value })} />
            </div>
            <div>
              <label className={ui.label} htmlFor="project-description">
                Description courte
              </label>
              <textarea
                id="project-description"
                className={ui.textarea}
                maxLength={500}
                value={draft.project.description}
                onChange={(e) => set("project", { ...draft.project, description: e.target.value })}
              />
            </div>
            <div>
              <label className={ui.label} htmlFor="project-tech">
                Technologies (8 maximum)
              </label>
              <input
                id="project-tech"
                className={ui.input}
                placeholder="Saisir puis Entrée — ex. : Django"
                value={techInput}
                disabled={draft.project.technologies.length >= 8}
                onChange={(e) => setTechInput(e.target.value)}
                onBlur={addTech}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTech();
                  }
                }}
              />
              {draft.project.technologies.length > 0 && (
                <ul className={styles.chips} style={{ marginTop: 8 }}>
                  {draft.project.technologies.map((t) => (
                    <li key={t} className={styles.chipItem}>
                      {t}
                      <button type="button" aria-label={`Retirer ${t}`} onClick={() => set("project", { ...draft.project, technologies: draft.project.technologies.filter((x) => x !== t) })}>
                        <CloseIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.row}>
              <div>
                <label className={ui.label} htmlFor="project-repo">
                  Dépôt de code (facultatif)
                </label>
                <input
                  id="project-repo"
                  className={ui.input}
                  type="url"
                  inputMode="url"
                  placeholder="https://github.com/…"
                  value={draft.project.repository_url}
                  onChange={(e) => set("project", { ...draft.project, repository_url: e.target.value })}
                />
              </div>
              <div>
                <label className={ui.label} htmlFor="project-url">
                  Site du projet (facultatif)
                </label>
                <input
                  id="project-url"
                  className={ui.input}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={draft.project.url}
                  onChange={(e) => set("project", { ...draft.project, url: e.target.value })}
                />
              </div>
            </div>
          </div>,
          () => set("tool", null),
        )}

      <div className={styles.toolbar} role="toolbar" aria-label="Ajouter à la publication">
        <span className={styles.toolbarLabel}>Ajouter à votre publication</span>
        {TOOLS.map(({ tool, label, Icon }) => (
          <button
            key={tool}
            type="button"
            className={styles.toolButton}
            aria-pressed={tool === "media" ? showMedia : draft.tool === tool}
            aria-label={label}
            title={label}
            onClick={() => setTool(tool)}
          >
            <Icon />
          </button>
        ))}
      </div>

      {error && (
        <p id="composer-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
