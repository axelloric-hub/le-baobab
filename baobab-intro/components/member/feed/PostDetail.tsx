"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePost } from "@/features/social/hooks";
import { ApiError } from "@/lib/api/errors";
import { ROUTES } from "@/lib/routes";
import { CommentThread } from "../post/CommentThread";
import { PostCard, PostCardSkeleton } from "../post/PostCard";
import { RightRail } from "../rail/RightRail";
import { cx } from "../ui/cx";
import { ArrowLeftIcon, LockIcon } from "../ui/icons";
import { EmptyState, ErrorState } from "../ui/States";
import ui from "../ui/ui.module.css";
import styles from "./Feed.module.css";

/** Page d'une publication : contenu complet + discussion. */
export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const post = usePost(id);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const full = post.data && !post.isPlaceholderData;

  // Arrivée par « Commenter » (#commentaires) : on place le curseur dans la zone de saisie.
  useEffect(() => {
    if (full && window.location.hash === "#commentaires") {
      document.getElementById("commentaires")?.scrollIntoView({ block: "start" });
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [full]);

  const back = () => (window.history.length > 1 ? router.back() : router.push(ROUTES.feed));

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <button type="button" className={styles.back} onClick={back}>
          <ArrowLeftIcon aria-hidden="true" />
          Retour
        </button>
        <h1 className="bb-visually-hidden">Publication</h1>
        {post.data ? (
          <>
            <PostCard post={post.data} variant={full ? "detail" : "feed"} onComment={() => inputRef.current?.focus()} />
            {full && <CommentThread post={post.data} inputRef={inputRef} />}
          </>
        ) : post.isPending ? (
          <PostCardSkeleton />
        ) : post.error instanceof ApiError && post.error.status === 404 ? (
          <EmptyState
            icon={<LockIcon />}
            title="Publication introuvable"
            text="Elle a peut-être été supprimée, ou son audience ne vous inclut pas."
            actions={
              <button type="button" className={cx(ui.button, ui.primary)} onClick={() => router.push(ROUTES.feed)}>
                Retour au fil
              </button>
            }
          />
        ) : (
          <ErrorState error={post.error} onRetry={() => post.refetch()} />
        )}
      </div>
      <aside className={styles.rail} aria-label="Pour vous">
        <RightRail />
      </aside>
    </div>
  );
}
