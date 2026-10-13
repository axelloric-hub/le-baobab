"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useMe } from "@/features/me/me";
import { usePortfolio, useProfile, useUserPosts } from "@/features/people/hooks";
import { ApiError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { PostList } from "../feed/PostList";
import { AwardIcon, CommentIcon, LockIcon, ProjectIcon, TimelineIcon, UserIcon } from "../ui/icons";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { EditProfileDialog } from "./EditProfileDialog";
import { PortfolioDialog, type AddKind } from "./PortfolioDialogs";
import { ProfileHeader } from "./ProfileHeader";
import { AboutCard, CertificatesCard, CompletionCard, JourneyCard, ProjectsCard, SkillsCard } from "./ProfileSections";
import styles from "./Profile.module.css";

type Tab = "apercu" | "publications" | "projets" | "parcours" | "certificats";

const TABS: Array<{ id: Tab; label: string; Icon: typeof UserIcon }> = [
  { id: "apercu", label: "Aperçu", Icon: UserIcon },
  { id: "publications", label: "Publications", Icon: CommentIcon },
  { id: "projets", label: "Projets", Icon: ProjectIcon },
  { id: "parcours", label: "Parcours", Icon: TimelineIcon },
  { id: "certificats", label: "Certificats", Icon: AwardIcon },
];

/** Profil développeur : en-tête, relations, onglets (≤ 6), et sur mon profil, l'édition. */
export function ProfilePage({ username }: { username: string }) {
  const me = useMe();
  const myUsername = me.data?.username ?? currentUser()?.username;
  const isMe = myUsername === username;
  const profile = useProfile(username);
  const portfolio = usePortfolio(username);
  const [tab, setTab] = useState<Tab>("apercu");
  const posts = useUserPosts(username, tab === "publications");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<AddKind | null>(null);
  const postList = useMemo(() => posts.data?.pages.flatMap((p) => p.results) ?? [], [posts.data]);

  // L'onglet est reflété dans l'adresse (?onglet=…) pour pouvoir le partager.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("onglet") as Tab | null;
    if (fromUrl && TABS.some((t) => t.id === fromUrl)) setTab(fromUrl);
  }, []);
  const select = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "apercu") url.searchParams.delete("onglet");
    else url.searchParams.set("onglet", next);
    window.history.replaceState(null, "", url);
  };

  const onTabKey = (event: KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const go = (i: number) => {
      event.preventDefault();
      const next = TABS[(i + TABS.length) % TABS.length].id;
      select(next);
      document.getElementById(`onglet-${next}`)?.focus();
    };
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(TABS.length - 1);
  };

  if (profile.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.header}>
          <div className={styles.cover} />
          <div className={styles.identity} style={{ paddingTop: 16 }}>
            <Skeleton width={96} height={96} radius="50%" style={{ marginTop: -64 }} />
            <Skeleton width="40%" height={26} />
            <Skeleton width="60%" height={14} />
          </div>
        </div>
      </div>
    );
  }

  if (profile.isError) {
    const hidden = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <div className={styles.page}>
        {hidden ? (
          <EmptyState icon={<LockIcon />} title="Profil indisponible" text="Ce profil n'existe pas, est privé, ou n'est pas visible pour vous." />
        ) : (
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        )}
      </div>
    );
  }

  const data = profile.data;
  const pf = portfolio.data;
  const counts: Partial<Record<Tab, number>> = {
    publications: data.stats?.posts,
    projets: pf ? pf.projects.length + pf.repositories.length : undefined,
    parcours: pf ? pf.experiences.length + pf.educations.length : undefined,
    certificats: pf ? pf.certificates.length + pf.achievements.length : undefined,
  };

  return (
    <div className={styles.page}>
      <ProfileHeader profile={data} isMe={isMe} onEdit={() => setEditing(true)} />

      <div className={styles.tabs} role="tablist" aria-label="Sections du profil" onKeyDown={onTabKey}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`onglet-${id}`}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === id}
            aria-controls={`panneau-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => select(id)}
          >
            <Icon aria-hidden="true" />
            {label}
            {counts[id] ? <span className={styles.tabCount}>{counts[id]}</span> : null}
          </button>
        ))}
      </div>

      <div id={`panneau-${tab}`} key={tab} role="tabpanel" aria-labelledby={`onglet-${tab}`} className={styles.panel}>
        {tab === "apercu" && (
          <div className={styles.grid}>
            <div className={styles.column}>
              <AboutCard profile={data} isMe={isMe} onEdit={() => setEditing(true)} />
              <SkillsCard profile={data} isMe={isMe} onEdit={() => setEditing(true)} />
              <ProjectsCard portfolio={pf} isMe={isMe} onAdd={setAdding} limit={4} title="Projets à la une" />
            </div>
            <aside className={styles.column} aria-label="En bref">
              {isMe && <CompletionCard profile={data} portfolio={pf} onEdit={() => setEditing(true)} />}
              <JourneyCard portfolio={pf} isMe={isMe} onAdd={setAdding} />
            </aside>
          </div>
        )}
        {tab === "publications" && (
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <PostList
              posts={postList}
              isPending={posts.isPending}
              isError={posts.isError}
              error={posts.error}
              refetch={() => posts.refetch()}
              hasNextPage={posts.hasNextPage}
              isFetchingNextPage={posts.isFetchingNextPage}
              fetchNextPage={() => posts.fetchNextPage()}
              endLabel="Fin des publications."
              empty={<EmptyState icon={<CommentIcon />} title="Aucune publication visible" text={isMe ? "Vos publications apparaîtront ici." : "Aucune publication que vous pouvez voir pour l'instant."} />}
            />
          </div>
        )}
        {tab === "projets" && <ProjectsCard portfolio={pf} isMe={isMe} onAdd={setAdding} />}
        {tab === "parcours" && <JourneyCard portfolio={pf} isMe={isMe} onAdd={setAdding} />}
        {tab === "certificats" && <CertificatesCard portfolio={pf} isMe={isMe} onAdd={setAdding} />}
        {portfolio.isError && tab !== "publications" && tab !== "apercu" && (
          <p className={styles.empty} style={{ marginTop: 16 }}>
            Le portfolio de ce membre n&apos;est pas visible pour vous.
          </p>
        )}
      </div>

      {isMe && <EditProfileDialog open={editing} onClose={() => setEditing(false)} profile={data} />}
      {isMe && <PortfolioDialog kind={adding} username={username} onClose={() => setAdding(null)} />}
    </div>
  );
}
