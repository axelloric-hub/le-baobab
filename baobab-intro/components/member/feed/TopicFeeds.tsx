"use client";

import { useMemo } from "react";
import { useHashtag, useSaved } from "@/features/social/hooks";
import { RightRail } from "../rail/RightRail";
import { useCreation } from "../shell/creation-context";
import { cx } from "../ui/cx";
import { BookmarkIcon, HashIcon, PenIcon } from "../ui/icons";
import { EmptyState } from "../ui/States";
import ui from "../ui/ui.module.css";
import styles from "./Feed.module.css";
import { PostList } from "./PostList";

type Paged = ReturnType<typeof useSaved>;

function Listing({ query, empty, header }: { query: Paged; empty: React.ReactNode; header: React.ReactNode }) {
  const posts = useMemo(() => query.data?.pages.flatMap((page) => page.results) ?? [], [query.data]);
  return (
    <div className={styles.page}>
      <div className={styles.column}>
        {header}
        <PostList
          posts={posts}
          isPending={query.isPending}
          isError={query.isError}
          error={query.error}
          refetch={() => query.refetch()}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={() => query.fetchNextPage()}
          empty={empty}
          endLabel="Fin de la liste."
        />
      </div>
      <aside className={styles.rail} aria-label="Pour vous">
        <RightRail />
      </aside>
    </div>
  );
}

/** « Enregistrés » : les publications mises de côté. */
export function SavedFeed() {
  const saved = useSaved();
  return (
    <Listing
      query={saved}
      header={
        <header className={styles.pageHeader}>
          <span className={styles.pageHeaderIcon} aria-hidden="true">
            <BookmarkIcon />
          </span>
          <div>
            <h1 className={styles.pageTitle}>Enregistrés</h1>
            <p className={styles.pageLead}>Les publications que vous avez gardées pour plus tard. Elles ne sont visibles que par vous.</p>
          </div>
        </header>
      }
      empty={
        <EmptyState
          icon={<BookmarkIcon />}
          title="Rien d'enregistré pour l'instant"
          text="Touchez « Enregistrer » sous une publication pour la retrouver ici."
        />
      }
    />
  );
}

/** Publications d'un hashtag. */
export function HashtagFeed({ tag }: { tag: string }) {
  const query = useHashtag(tag);
  const { openPost } = useCreation();
  return (
    <Listing
      query={query}
      header={
        <header className={styles.pageHeader}>
          <span className={styles.pageHeaderIcon} aria-hidden="true">
            <HashIcon />
          </span>
          <div>
            <h1 className={styles.pageTitle}>#{tag}</h1>
            <p className={styles.pageLead}>Les publications de ce hashtag que vous pouvez voir, des plus récentes aux plus anciennes.</p>
          </div>
        </header>
      }
      empty={
        <EmptyState
          icon={<HashIcon />}
          title={`Aucune publication pour #${tag}`}
          text="Soyez la première personne à en parler."
          actions={
            <button type="button" className={cx(ui.button, ui.primary)} onClick={() => openPost()}>
              <PenIcon />
              Créer une publication
            </button>
          }
        />
      }
    />
  );
}
