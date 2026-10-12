"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import type { Post } from "@/features/social/types";
import { PostCard, PostCardSkeleton } from "../post/PostCard";
import { cx } from "../ui/cx";
import { ErrorState, Spinner } from "../ui/States";
import ui from "../ui/ui.module.css";
import styles from "./Feed.module.css";

interface PostListProps {
  posts: Post[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  empty: ReactNode;
  /** Élément inséré après la n-ième publication (emplacement publicitaire du fil). */
  insertAfter?: { index: number; node: ReactNode };
  freshIds?: Set<string>;
  endLabel?: string;
}

/** Liste de publications à défilement continu, avec états de chargement, d'erreur et de fin. */
export function PostList({
  posts,
  isPending,
  isError,
  error,
  refetch,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  empty,
  insertAfter,
  freshIds,
  endLabel = "Vous êtes à jour.",
}: PostListProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: "900px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return (
      <div className={styles.list} aria-busy="true" aria-label="Chargement des publications">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (isError && posts.length === 0) return <ErrorState error={error} onRetry={refetch} />;
  if (posts.length === 0) return <>{empty}</>;

  return (
    <div className={styles.list}>
      {posts.map((post, index) => (
        <Fragment key={post.id}>
          <PostCard post={post} isNew={freshIds?.has(post.id)} />
          {insertAfter && index === insertAfter.index && insertAfter.node}
        </Fragment>
      ))}
      <div ref={sentinel} className={styles.sentinel}>
        {isFetchingNextPage ? (
          <Spinner label="Chargement de la suite" />
        ) : hasNextPage ? (
          <button type="button" className={cx(ui.button, ui.secondary)} onClick={fetchNextPage}>
            Afficher plus
          </button>
        ) : (
          <p className={styles.end}>{endLabel}</p>
        )}
      </div>
      {isError && <ErrorState error={error} onRetry={refetch} />}
    </div>
  );
}
