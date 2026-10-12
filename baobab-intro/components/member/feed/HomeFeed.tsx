"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { socialApi } from "@/features/social/api";
import { keys, useFeed } from "@/features/social/hooks";
import { plural } from "@/lib/format";
import { InvitationsCard, RightRail } from "../rail/RightRail";
import { useCreation } from "../shell/creation-context";
import { StatusStrip } from "../statuses/StatusStrip";
import { cx } from "../ui/cx";
import { ArrowUpIcon, PenIcon, SparklesIcon, TrendingIcon } from "../ui/icons";
import { EmptyState } from "../ui/States";
import ui from "../ui/ui.module.css";
import { AdSlot } from "./AdSlot";
import { ComposerBar } from "./ComposerBar";
import styles from "./Feed.module.css";
import { PostList } from "./PostList";

/** Nouvelles publications arrivées en tête du fil depuis le chargement (vérifié chaque minute, onglet visible). */
function useFreshCount(knownIds: Set<string>, enabled: boolean) {
  // Première vérification une minute après l'arrivée : le fil vient d'être chargé.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setArmed(true), 60_000);
    return () => window.clearTimeout(timer);
  }, []);
  const head = useQuery({
    queryKey: ["feed-head"],
    queryFn: () => socialApi.feed(),
    enabled: enabled && armed,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 55_000,
  });
  return (head.data?.results ?? []).filter((post) => !knownIds.has(post.id)).length;
}

/** Page « Accueil » : statuts, composeur, fil infini, colonne latérale. */
export function HomeFeed() {
  const client = useQueryClient();
  const feed = useFeed();
  const { openPost, openSearch } = useCreation();
  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.results) ?? [], [feed.data]);
  const known = useMemo(() => new Set(posts.map((p) => p.id)), [posts]);
  const fresh = useFreshCount(known, feed.isSuccess);

  const showFresh = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    client.removeQueries({ queryKey: ["feed-head"] });
    void client.resetQueries({ queryKey: keys.feed });
  };

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <h1 className="bb-visually-hidden">Fil d&apos;actualité</h1>
        {fresh > 0 && (
          <div className={styles.freshWrap}>
            <button type="button" className={styles.fresh} onClick={showFresh}>
              <ArrowUpIcon aria-hidden="true" />
              {plural(fresh, "nouvelle publication", "nouvelles publications")}
            </button>
          </div>
        )}
        <StatusStrip />
        <div className={styles.railInline}>
          <InvitationsCard />
        </div>
        <ComposerBar />
        <PostList
          posts={posts}
          isPending={feed.isPending}
          isError={feed.isError}
          error={feed.error}
          refetch={() => feed.refetch()}
          hasNextPage={feed.hasNextPage}
          isFetchingNextPage={feed.isFetchingNextPage}
          fetchNextPage={() => feed.fetchNextPage()}
          insertAfter={{ index: 4, node: <AdSlot placement="feed" /> }}
          endLabel="Vous avez tout vu. Revenez plus tard pour de nouvelles publications."
          empty={
            <EmptyState
              icon={<SparklesIcon />}
              title="Votre fil vous attend"
              text="Publiez votre première idée, un extrait de code ou un projet. Les publications des personnes que vous suivez et de vos groupes apparaîtront ici."
              actions={
                <>
                  <button type="button" className={cx(ui.button, ui.primary)} onClick={() => openPost()}>
                    <PenIcon />
                    Créer une publication
                  </button>
                  <button type="button" className={cx(ui.button, ui.secondary)} onClick={openSearch}>
                    <TrendingIcon />
                    Explorer les hashtags
                  </button>
                </>
              }
            />
          }
        />
      </div>
      <aside className={styles.rail} aria-label="Pour vous">
        <RightRail />
      </aside>
    </div>
  );
}
