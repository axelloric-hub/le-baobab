"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useProjectMutations, useShowcaseProject } from "@/features/showcase/hooks";
import type { ShowcaseProjectDetail } from "@/features/showcase/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { ROUTES } from "@/lib/routes";
import { uploadFile } from "@/lib/uploads/upload";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CodeIcon,
  ExternalIcon,
  ImageIcon,
  LinkIcon,
  LockIcon,
  MoreIcon,
  PenIcon,
  RepoIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
  VerifiedIcon,
} from "../ui/icons";
import { Menu } from "../ui/Menu";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { LINK_LABELS, ProjectCard } from "./ProjectCard";
import { AddLinkDialog, EditProjectDialog } from "./ProjectDialogs";
import styles from "./Showcase.module.css";

const MONTH = new Intl.DateTimeFormat("fr", { month: "long", year: "numeric" });
const month = (iso: string) => MONTH.format(new Date(`${iso.slice(0, 10)}T12:00:00`));

function period(p: ShowcaseProjectDetail) {
  if (p.started_on && p.ended_on) return `${month(p.started_on)} — ${month(p.ended_on)}`;
  if (p.started_on) return `Depuis ${month(p.started_on)}`;
  if (p.ended_on) return `Terminé en ${month(p.ended_on)}`;
  return null;
}

function Gallery({ project, onRemove, busy }: { project: ShowcaseProjectDetail; onRemove?: (id: string) => void; busy?: boolean }) {
  const [index, setIndex] = useState(0);
  const media = project.media;
  const current = media[Math.min(index, media.length - 1)];
  if (!current) return null;
  return (
    <section className={styles.gallery} aria-label="Captures du projet">
      <div className={styles.stage}>
        {current.kind === "video" ? (
          <video key={current.id} src={current.url} controls preload="metadata" />
        ) : current.kind === "image" ? (
          <img key={current.id} src={current.url} alt={`${project.title} — capture ${index + 1} sur ${media.length}`} />
        ) : (
          <a href={current.url} target="_blank" rel="noopener noreferrer" className={cx(ui.button, ui.secondary)} style={{ position: "absolute", inset: 0, margin: "auto", width: "fit-content", height: "fit-content" }}>
            Ouvrir le document
            <ExternalIcon />
          </a>
        )}
      </div>
      {(media.length > 1 || onRemove) && (
        <ul className={styles.thumbs}>
          {media.map((m, i) => (
            <li key={m.id} style={{ position: "relative" }}>
              <button type="button" className={styles.thumb} aria-current={i === index} aria-label={`Afficher la capture ${i + 1}`} onClick={() => setIndex(i)}>
                {m.kind === "video" ? <video src={m.url} preload="metadata" muted /> : m.kind === "image" ? <img src={m.url} alt="" loading="lazy" /> : null}
              </button>
              {onRemove && (
                <button
                  type="button"
                  className={cx(ui.iconButton, ui.small, styles.thumbRemove)}
                  style={{ background: "rgba(255,255,255,0.94)" }}
                  aria-label={`Retirer la capture ${i + 1}`}
                  disabled={busy}
                  onClick={() => {
                    setIndex(0);
                    onRemove(m.id);
                  }}
                >
                  <TrashIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OwnerTools({ project }: { project: ShowcaseProjectDetail }) {
  const toast = useToast();
  const router = useRouter();
  const m = useProjectMutations(project.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const room = 12 - project.media.length;

  const upload = async (files: FileList) => {
    const list = Array.from(files).slice(0, room);
    let added = 0;
    for (const [i, file] of list.entries()) {
      try {
        setUploading(i / list.length);
        const id = await uploadFile(file, "portfolio_media", { onProgress: (p) => setUploading((i + p) / list.length) });
        await m.addMedia.mutateAsync(id);
        added += 1;
      } catch (error) {
        toast(`${file.name} : ${describeError(error)}`, { tone: "error" });
      }
    }
    setUploading(null);
    if (added) toast(added > 1 ? `${added} médias ajoutés.` : "Média ajouté.", { tone: "success" });
  };

  return (
    <>
      <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setEditing(true)}>
        <PenIcon />
        Modifier
      </button>
      <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => fileRef.current?.click()} disabled={uploading !== null || room <= 0} title={room <= 0 ? "12 médias au plus par projet" : undefined}>
        <ImageIcon />
        {uploading !== null ? `Envoi… ${Math.round(uploading * 100)} %` : "Ajouter des captures"}
      </button>
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <Menu
        label="Actions du projet"
        trigger={<MoreIcon />}
        items={[
          { label: "Ajouter un lien", icon: <LinkIcon />, onSelect: () => setLinking(true) },
          {
            label: project.is_featured ? "Retirer l'épingle" : "Épingler en tête du portfolio",
            icon: <StarIcon />,
            onSelect: () =>
              m.update.mutate(
                { is_featured: !project.is_featured },
                { onSuccess: () => toast(project.is_featured ? "Projet désépinglé." : "Projet épinglé.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) },
              ),
          },
          { label: "Supprimer le projet", icon: <TrashIcon />, tone: "danger", onSelect: () => setDeleting(true) },
        ]}
      />
      <EditProjectDialog project={project} open={editing} onClose={() => setEditing(false)} />
      <AddLinkDialog projectId={project.id} open={linking} onClose={() => setLinking(false)} />
      <ConfirmDialog
        open={deleting}
        busy={m.remove.isPending}
        onClose={() => setDeleting(false)}
        title={`Supprimer « ${project.title} » ?`}
        text="Le projet, ses captures et ses liens seront retirés de votre portfolio. Cette action est définitive."
        confirm="Supprimer"
        onConfirm={() =>
          m.remove.mutate(undefined, {
            onSuccess: () => {
              toast("Projet supprimé.", { tone: "success" });
              router.replace(`${ROUTES.showcase}?onglet=mon-portfolio`);
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          })
        }
      />
    </>
  );
}

export function ProjectPage({ id }: { id: string }) {
  const query = useShowcaseProject(id);
  const toast = useToast();
  const m = useProjectMutations(id);

  if (query.isPending) {
    return (
      <div className={layout.page}>
        <Skeleton height={180} radius={18} />
        <Skeleton height={320} radius={18} />
      </div>
    );
  }
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={ROUTES.showcase} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Showcase
        </Link>
        {gone ? (
          <EmptyState icon={<LockIcon />} title="Projet introuvable" text="Ce projet a été supprimé, ou son portfolio n'est pas visible pour vous." />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const p = query.data;
  const owner = p.owner.display_name || p.owner.username;
  const when = period(p);
  const demo = p.links.find((l) => l.kind === "demo");
  const code = p.links.find((l) => l.kind === "repository");

  return (
    <div className={layout.page}>
      <Link href={p.is_mine ? `${ROUTES.showcase}?onglet=mon-portfolio` : ROUTES.showcase} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        {p.is_mine ? "Mon portfolio" : "Showcase"}
      </Link>
      <div className={styles.split}>
        <div className={layout.stack}>
          <header className={styles.hero}>
            {p.is_featured && (
              <span style={{ alignSelf: "flex-start" }}>
                <Pill tone="amber">Projet épinglé</Pill>
              </span>
            )}
            <h1 className={styles.heroTitle}>{p.title}</h1>
            <ul className={styles.heroMeta}>
              <li>
                <Avatar name={owner} src={p.owner.avatar_url} size={24} />
                <Link href={ROUTES.profile(p.owner.username)}>{owner}</Link>
              </li>
              {p.role && (
                <li>
                  <UserIcon aria-hidden="true" />
                  {p.role}
                </li>
              )}
              {when && (
                <li>
                  <CalendarIcon aria-hidden="true" />
                  {when}
                </li>
              )}
            </ul>
            <div className={styles.actions}>
              {demo && (
                <a href={demo.url} target="_blank" rel="noopener noreferrer nofollow" className={cx(ui.button, p.is_mine ? ui.secondary : ui.primary)}>
                  <ExternalIcon />
                  Voir la démo
                </a>
              )}
              {code && (
                <a href={code.url} target="_blank" rel="noopener noreferrer nofollow" className={cx(ui.button, ui.secondary)}>
                  <CodeIcon />
                  Voir le code
                </a>
              )}
              {p.is_mine && <OwnerTools project={p} />}
            </div>
          </header>

          {p.media.length > 0 ? (
            <Gallery
              project={p}
              busy={m.removeMedia.isPending}
              onRemove={p.is_mine ? (mediaId) => m.removeMedia.mutate(mediaId, { onSuccess: () => toast("Capture retirée.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) }) : undefined}
            />
          ) : (
            p.is_mine && (
              <div className={styles.dropHint}>
                <ImageIcon aria-hidden="true" />
                <p>Ajoutez des captures d&apos;écran ou une courte vidéo : la première servira de couverture dans la vitrine.</p>
              </div>
            )
          )}

          <section className={layout.panelCard} aria-labelledby="projet-description">
            <h2 id="projet-description" className={layout.panelTitle}>
              À propos du projet
            </h2>
            {p.description ? <p className={styles.description}>{p.description}</p> : <p className={ui.hint}>{p.is_mine ? "Décrivez le problème résolu, vos choix techniques et le résultat." : "Pas encore de description."}</p>}
          </section>

          {p.more.length > 0 && (
            <section aria-labelledby="autres-projets" className={layout.stack}>
              <h2 id="autres-projets" className={layout.sectionTitle}>
                Autres projets de {owner}
              </h2>
              <div className={layout.grid}>
                {p.more.map((o) => (
                  <ProjectCard key={o.id} project={o} showOwner={false} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className={styles.side} aria-label="Informations du projet">
          <section className={layout.panelCard} aria-labelledby="projet-technos">
            <h2 id="projet-technos" className={layout.panelTitle}>
              <CodeIcon aria-hidden="true" />
              Technologies
            </h2>
            {p.technologies.length > 0 ? (
              <ul className={styles.techs}>
                {p.technologies.map((t) => (
                  <li key={t.slug} className={styles.tech}>
                    {t.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={ui.hint} style={{ margin: 0 }}>
                Aucune technologie renseignée.
              </p>
            )}
          </section>

          {(p.links.length > 0 || p.is_mine) && (
            <section className={layout.panelCard} aria-labelledby="projet-liens">
              <h2 id="projet-liens" className={layout.panelTitle}>
                <LinkIcon aria-hidden="true" />
                Liens
              </h2>
              {p.links.length === 0 ? (
                <p className={ui.hint} style={{ margin: 0 }}>
                  Ajoutez la démo, le dépôt ou un article depuis le menu du projet.
                </p>
              ) : (
                <ul className={styles.linkList}>
                  {p.links.map((l) => (
                    <li key={l.id} className={styles.linkRow}>
                      <Pill tone="neutral">{LINK_LABELS[l.kind] ?? "Lien"}</Pill>
                      <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" title={l.url}>
                        {l.url.replace(/^https:\/\/(www\.)?/, "")}
                      </a>
                      {p.is_mine && (
                        <button
                          type="button"
                          className={cx(ui.iconButton, ui.small)}
                          aria-label={`Retirer le lien ${LINK_LABELS[l.kind] ?? ""}`}
                          disabled={m.removeLink.isPending}
                          onClick={() => m.removeLink.mutate(l.id, { onSuccess: () => toast("Lien retiré.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) })}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {p.repositories.length > 0 && (
            <section className={layout.panelCard} aria-labelledby="projet-depots">
              <h2 id="projet-depots" className={layout.panelTitle}>
                <RepoIcon aria-hidden="true" />
                Dépôts
              </h2>
              <div className={layout.stack} style={{ gap: 8 }}>
                {p.repositories.map((r) => (
                  <div key={r.id} className={styles.repo}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">
                      {r.full_name}
                    </a>
                    {r.description && <span className={ui.hint}>{r.description}</span>}
                    <span className={styles.repoMeta}>
                      {r.language && <span>{r.language}</span>}
                      <span>
                        <StarIcon aria-hidden="true" />
                        {r.stars}
                      </span>
                      {r.verified && (
                        <span>
                          <VerifiedIcon aria-hidden="true" />
                          Vérifié sur GitHub
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={layout.panelCard} aria-labelledby="projet-auteur">
            <h2 id="projet-auteur" className={layout.panelTitle}>
              <UserIcon aria-hidden="true" />
              Auteur
            </h2>
            <div className={styles.owner}>
              <Avatar name={owner} src={p.owner.avatar_url} size={44} />
              <span style={{ minWidth: 0 }}>
                <Link href={ROUTES.profile(p.owner.username)}>{owner}</Link>
                <span className={ui.hint} style={{ display: "block", margin: 0 }}>
                  @{p.owner.username}
                </span>
              </span>
            </div>
            <Link href={ROUTES.profile(p.owner.username)} className={cx(ui.button, ui.secondary, ui.small)} style={{ marginTop: 12 }}>
              Voir le portfolio complet
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
