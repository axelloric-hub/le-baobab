"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { useMe } from "@/features/me/me";
import { useDeletePost, useReact, useToggleSave } from "@/features/social/hooks";
import type { Post } from "@/features/social/types";
import { currentUser } from "@/lib/auth/session";
import { fullDate, plural, relativeTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  CommentIcon,
  CopyIcon,
  ExternalIcon,
  FlagIcon,
  HubIcon,
  MoreIcon,
  PenIcon,
  ShareIcon,
  TrashIcon,
} from "../ui/icons";
import { Menu, type MenuEntry } from "../ui/Menu";
import { reactionOf } from "../ui/reactions";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { visibilityOf } from "../ui/visibility";
import { PostAttachment } from "./PostAttachment";
import { ConfirmDialog, EditDialog, ReportDialog, ShareDialog } from "./PostDialogs";
import { PostMedia } from "./PostMedia";
import styles from "./Post.module.css";
import { ReactionButton } from "./ReactionButton";
import { RichBody } from "./rich-text";
import { useViewTracking } from "./use-view-tracking";

/** Le fil ne transporte que les 500 premiers caractères du texte (apps/social/feed.py). */
const FEED_EXCERPT = 500;

interface PostCardProps {
  post: Post;
  variant?: "feed" | "detail";
  /** Publication qu'on vient de créer : légère mise en valeur à l'arrivée. */
  isNew?: boolean;
  /** Page de détail : « Commenter » place le curseur dans la zone de saisie. */
  onComment?: () => void;
}

function useIsMine(post: Post) {
  const me = useMe();
  const username = me.data?.username ?? currentUser()?.username;
  return Boolean(username) && username === post.author.username;
}

async function copyLink(id: string) {
  const url = `${window.location.origin}${ROUTES.post(id)}`;
  await navigator.clipboard.writeText(url);
}

function PostCardImpl({ post, variant = "feed", isNew, onComment }: PostCardProps) {
  const router = useRouter();
  const toast = useToast();
  const mine = useIsMine(post);
  const react = useReact(post);
  const save = useToggleSave(post);
  const remove = useDeletePost(post);
  const articleRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<null | "report" | "share" | "edit" | "delete">(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useViewTracking(articleRef, post.id);

  const isFeed = variant === "feed";
  const truncated = isFeed && post.body.length >= FEED_EXCERPT;
  const clamp = isFeed && !expanded;

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (node && clamp) setOverflowing(node.scrollHeight > node.clientHeight + 2);
  }, [clamp, post.body]);

  const visibility = visibilityOf(post.visibility);
  const reaction = reactionOf(post.my_reaction ?? null);
  const name = post.author.display_name || post.author.username;
  const titleId = `post-${post.id}-author`;
  const detailHref = ROUTES.post(post.id);

  const onCopy = () =>
    copyLink(post.id).then(
      () => toast("Lien copié dans le presse-papiers.", { tone: "success" }),
      () => toast("Impossible de copier le lien sur cet appareil.", { tone: "error" }),
    );

  const onSave = () =>
    save.mutate(!post.saved, {
      onSuccess: () =>
        toast(post.saved ? "Retirée de vos enregistrements." : "Publication enregistrée.", {
          tone: "success",
          action: post.saved ? undefined : { label: "Voir", onClick: () => router.push(ROUTES.saved) },
        }),
      onError: () => toast("L'enregistrement n'a pas abouti. Réessayez.", { tone: "error" }),
    });

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareItems: MenuEntry[] = [
    { label: "Partager sur mon fil", icon: <ShareIcon />, onSelect: () => setDialog("share") },
    { label: "Copier le lien", icon: <CopyIcon />, onSelect: onCopy },
    ...(canNativeShare
      ? [
          {
            label: "Partager via…",
            icon: <ExternalIcon />,
            onSelect: () => void navigator.share({ title: post.title || `Publication de ${name}`, url: `${window.location.origin}${detailHref}` }).catch(() => {}),
          },
        ]
      : []),
  ];

  const moreItems: MenuEntry[] = [
    { label: post.saved ? "Retirer des enregistrements" : "Enregistrer", icon: post.saved ? <BookmarkFilledIcon /> : <BookmarkIcon />, onSelect: onSave },
    { label: "Copier le lien", icon: <CopyIcon />, onSelect: onCopy },
    { kind: "separator" },
    ...(mine
      ? ([
          { label: "Modifier", icon: <PenIcon />, onSelect: () => setDialog("edit") },
          { label: "Supprimer", icon: <TrashIcon />, tone: "danger", onSelect: () => setDialog("delete") },
        ] as MenuEntry[])
      : ([{ label: "Signaler", icon: <FlagIcon />, tone: "danger", onSelect: () => setDialog("report") }] as MenuEntry[])),
  ];

  const counters = post.counters;

  return (
    <article ref={articleRef} className={styles.card} data-new={isNew || undefined} aria-labelledby={titleId}>
      <header className={styles.header}>
        <Avatar name={name} src={post.author.avatar_url} size={44} />
        <div className={styles.who}>
          <p className={styles.authorLine}>
            <span id={titleId} className={styles.author}>
              {name}
            </span>
            <span className={styles.handle}>@{post.author.username}</span>
            {post.group_name && (
              <span className={styles.group}>
                <HubIcon aria-hidden="true" />
                <span className="bb-visually-hidden">dans le groupe</span>
                {post.group_name}
              </span>
            )}
          </p>
          <p className={styles.meta}>
            {isFeed ? (
              <Link href={detailHref} className={styles.timeLink}>
                <time dateTime={post.published_at} title={fullDate(post.published_at)}>
                  {relativeTime(post.published_at)}
                </time>
              </Link>
            ) : (
              <time dateTime={post.published_at} title={fullDate(post.published_at)}>
                {fullDate(post.published_at)}
              </time>
            )}
            {post.edited_at && <span className={styles.edited}>· modifiée</span>}
            <span className={styles.metaDot} aria-hidden="true" />
            <span className={styles.visibility} title={visibility.hint}>
              <visibility.Icon aria-hidden="true" />
              {visibility.label}
            </span>
          </p>
        </div>
        <div className={styles.headerMenu}>
          <Menu label="Plus d'actions" items={moreItems} trigger={<MoreIcon />} />
        </div>
      </header>

      <div className={styles.content}>
        {post.title && <h2 className={styles.title}>{post.title}</h2>}
        {post.body && (
          <>
            <div ref={bodyRef} className={clamp ? styles.clamped : undefined}>
              <RichBody text={post.body} className={styles.body} />
            </div>
            {truncated ? (
              <Link href={detailHref} className={styles.more}>
                Lire la suite
              </Link>
            ) : (
              clamp &&
              overflowing && (
                <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
                  Voir plus
                </button>
              )
            )}
          </>
        )}
        <PostAttachment post={post} />
        <PostMedia media={post.media} onDoubleTap={() => !post.my_reaction && react.mutate("like")} />
      </div>

      <div className={styles.stats}>
        <span className={styles.statsReactions}>
          {counters.reactions > 0 && (
            <>
              <span className={styles.statsEmoji} aria-hidden="true">
                {reaction?.emoji ?? "👍"}
              </span>
              {plural(counters.reactions, "réaction", "réactions")}
            </>
          )}
        </span>
        <span className={styles.statsRight}>
          {counters.comments > 0 &&
            (isFeed ? (
              <Link href={`${detailHref}#commentaires`} className={styles.statsLink}>
                {plural(counters.comments, "commentaire", "commentaires")}
              </Link>
            ) : (
              <span>{plural(counters.comments, "commentaire", "commentaires")}</span>
            ))}
          {counters.shares > 0 && <span>{plural(counters.shares, "partage", "partages")}</span>}
          {!isFeed && counters.views > 0 && <span>{plural(counters.views, "vue", "vues")}</span>}
        </span>
      </div>

      <div className={styles.actions} role="group" aria-label="Actions sur la publication">
        <ReactionButton value={post.my_reaction ?? null} onChange={(type) => react.mutate(type)} />
        {isFeed ? (
          <Link href={`${detailHref}#commentaires`} className={styles.action}>
            <CommentIcon />
            <span className={styles.actionLabel}>Commenter</span>
          </Link>
        ) : (
          <button type="button" className={styles.action} onClick={onComment}>
            <CommentIcon />
            <span className={styles.actionLabel}>Commenter</span>
          </button>
        )}
        <Menu
          label="Partager"
          items={shareItems}
          side="top"
          align="left"
          triggerClassName={styles.action}
          trigger={
            <>
              <ShareIcon />
              <span className={styles.actionLabel}>Partager</span>
            </>
          }
        />
        <button type="button" className={styles.action} aria-pressed={Boolean(post.saved)} data-saved={post.saved || undefined} onClick={onSave}>
          {post.saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
          <span className={styles.actionLabel}>{post.saved ? "Enregistrée" : "Enregistrer"}</span>
        </button>
      </div>

      {dialog === "report" && <ReportDialog open onClose={() => setDialog(null)} target={{ type: "post", id: post.id }} />}
      {dialog === "share" && <ShareDialog open onClose={() => setDialog(null)} post={post} />}
      {dialog === "edit" && <EditDialog open onClose={() => setDialog(null)} post={post} />}
      {dialog === "delete" && (
        <ConfirmDialog
          open
          busy={remove.isPending}
          onClose={() => setDialog(null)}
          title="Supprimer la publication ?"
          text="Elle disparaîtra de votre fil et de celui des autres membres, avec ses commentaires. Cette action est définitive."
          confirm="Supprimer"
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                setDialog(null);
                toast("Publication supprimée.", { tone: "success" });
                if (!isFeed) router.replace(ROUTES.feed);
              },
              onError: () => toast("La suppression n'a pas abouti. Réessayez.", { tone: "error" }),
            })
          }
        />
      )}
    </article>
  );
}

export const PostCard = memo(PostCardImpl);

export function PostCardSkeleton() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={styles.skeletonHead}>
        <span className={ui.skeleton} style={{ width: 44, height: 44, borderRadius: "50%" }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <span className={ui.skeleton} style={{ width: "42%", height: 13 }} />
          <span className={ui.skeleton} style={{ width: "26%", height: 11 }} />
        </span>
      </div>
      <span className={ui.skeleton} style={{ width: "100%", height: 13 }} />
      <span className={ui.skeleton} style={{ width: "92%", height: 13 }} />
      <span className={ui.skeleton} style={{ width: "64%", height: 13 }} />
      <span className={ui.skeleton} style={{ width: "100%", height: 180, borderRadius: 12, marginTop: 4 }} />
    </div>
  );
}

