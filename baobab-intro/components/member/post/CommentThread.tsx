"use client";

import { useState, type RefObject } from "react";
import { useMe } from "@/features/me/me";
import { useAddComment, useComments, useDeleteComment, useReactComment, useReplies } from "@/features/social/hooks";
import type { Comment, Post } from "@/features/social/types";
import { describeError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { compactNumber, fullDate, relativeTime } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { ChevronDownIcon, CommentIcon, FlagIcon, SendIcon, ThumbIcon, TrashIcon } from "../ui/icons";
import { ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { ConfirmDialog, ReportDialog } from "./PostDialogs";
import styles from "./Post.module.css";
import { RichBody } from "./rich-text";

interface ReplyTarget {
  /** Commentaire racine : les réponses restent sur un seul niveau, plus lisible sur mobile. */
  rootId: string;
  username: string;
  name: string;
}

function useMyUsername() {
  const me = useMe();
  return me.data?.username ?? currentUser()?.username ?? "";
}

function CommentItem({
  post,
  comment,
  rootId,
  onReply,
  children,
}: {
  post: Post;
  comment: Comment;
  rootId: string;
  onReply: (target: ReplyTarget) => void;
  children?: React.ReactNode;
}) {
  const toast = useToast();
  const me = useMyUsername();
  const react = useReactComment(post.id, comment);
  const remove = useDeleteComment(post.id, comment);
  const [dialog, setDialog] = useState<null | "report" | "delete">(null);
  const name = comment.author.display_name || comment.author.username;
  const mine = me === comment.author.username;
  const liked = Boolean(comment.my_reaction);

  return (
    <li className={styles.comment}>
      <Avatar name={name} src={comment.author.avatar_url} size={comment.parent ? 32 : 36} />
      <div className={styles.commentMain}>
        <div className={styles.bubble} data-author={comment.author.username === post.author.username || undefined}>
          <p className={styles.bubbleHead}>
            <span className={styles.bubbleName}>{name}</span>
            {comment.author.username === post.author.username && <span className={styles.authorBadge}>Auteur</span>}
            <time className={styles.bubbleTime} dateTime={comment.created_at} title={fullDate(comment.created_at)}>
              {relativeTime(comment.created_at)}
            </time>
          </p>
          <RichBody text={comment.body} className={styles.bubbleBody} />
        </div>
        <div className={styles.commentActions}>
          <button
            type="button"
            className={styles.commentAction}
            aria-pressed={liked}
            aria-label={liked ? "Retirer « J'aime »" : "J'aime"}
            onClick={() => react.mutate(liked ? null : "like")}
          >
            <ThumbIcon />
            {comment.reactions > 0 && <span>{compactNumber(comment.reactions)}</span>}
            <span aria-hidden="true">J&apos;aime</span>
          </button>
          <button type="button" className={styles.commentAction} onClick={() => onReply({ rootId, username: comment.author.username, name })}>
            <CommentIcon />
            Répondre
          </button>
          {mine ? (
            <button type="button" className={styles.commentAction} onClick={() => setDialog("delete")}>
              <TrashIcon />
              Supprimer
            </button>
          ) : (
            <button type="button" className={styles.commentAction} onClick={() => setDialog("report")}>
              <FlagIcon />
              Signaler
            </button>
          )}
        </div>
        {children}
      </div>
      {dialog === "report" && <ReportDialog open onClose={() => setDialog(null)} target={{ type: "comment", id: comment.id }} />}
      {dialog === "delete" && (
        <ConfirmDialog
          open
          busy={remove.isPending}
          onClose={() => setDialog(null)}
          title="Supprimer le commentaire ?"
          text="Le commentaire sera retiré de la discussion. Cette action est définitive."
          confirm="Supprimer"
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                setDialog(null);
                toast("Commentaire supprimé.", { tone: "success" });
              },
              onError: () => toast("La suppression n'a pas abouti. Réessayez.", { tone: "error" }),
            })
          }
        />
      )}
    </li>
  );
}

function Replies({ post, root, open, onToggle, onReply }: { post: Post; root: Comment; open: boolean; onToggle: () => void; onReply: (t: ReplyTarget) => void }) {
  const replies = useReplies(root.id, open);
  if (root.replies === 0 && !replies.data) return null;
  const list = replies.data?.pages.flatMap((page) => page.results) ?? [];
  return (
    <>
      {!open && root.replies > 0 && (
        <button type="button" className={styles.repliesToggle} onClick={onToggle} aria-expanded="false">
          <ChevronDownIcon />
          {root.replies === 1 ? "Voir la réponse" : `Voir les ${compactNumber(root.replies)} réponses`}
        </button>
      )}
      {open && (
        <ul className={styles.replies} aria-label={`Réponses à ${root.author.display_name || root.author.username}`}>
          {replies.isPending && <Skeleton height={56} radius={12} />}
          {list.map((reply) => (
            <CommentItem key={reply.id} post={post} comment={reply} rootId={root.id} onReply={onReply} />
          ))}
          {replies.hasNextPage && (
            <li>
              <button type="button" className={styles.repliesToggle} onClick={() => replies.fetchNextPage()} disabled={replies.isFetchingNextPage}>
                Réponses suivantes
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  );
}

function CommentInput({
  post,
  replyTo,
  onCancelReply,
  onSent,
  inputRef,
  body,
  setBody,
}: {
  post: Post;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  onSent: (rootId: string | null) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  body: string;
  setBody: (value: string) => void;
}) {
  const me = useMe();
  const add = useAddComment(post.id, replyTo?.rootId);
  const toast = useToast();
  const name = me.data?.display_name || me.data?.username || currentUser()?.username || "";

  const send = () => {
    const text = body.trim();
    if (!text || add.isPending) return;
    add.mutate(text, {
      onSuccess: () => {
        setBody("");
        onSent(replyTo?.rootId ?? null);
      },
      onError: (error) => toast(describeError(error), { tone: "error" }),
    });
  };

  return (
    <div className={styles.composerSticky}>
      {replyTo && (
        <p className={styles.replyingTo}>
          En réponse à <strong>{replyTo.name}</strong>
          <button type="button" onClick={onCancelReply}>
            Annuler
          </button>
        </p>
      )}
      <form
        className={styles.commentForm}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Avatar name={name || "?"} src={me.data?.avatar_url} size={36} />
        <div className={styles.commentField}>
          <label htmlFor={`comment-${post.id}`} className="bb-visually-hidden">
            {replyTo ? `Répondre à ${replyTo.name}` : "Écrire un commentaire"}
          </label>
          <textarea
            id={`comment-${post.id}`}
            ref={inputRef}
            rows={1}
            maxLength={5000}
            value={body}
            placeholder={replyTo ? `Répondre à ${replyTo.name}…` : "Écrire un commentaire…"}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Ordinateur : Entrée envoie, Maj + Entrée passe à la ligne. Mobile : bouton « Envoyer ».
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" className={styles.sendButton} disabled={!body.trim() || add.isPending} aria-label="Envoyer le commentaire">
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

/** Discussion d'une publication : commentaires récents d'abord, réponses chargées à la demande. */
export function CommentThread({ post, inputRef }: { post: Post; inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const comments = useComments(post.id);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [openReplies, setOpenReplies] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const list = comments.data?.pages.flatMap((page) => page.results) ?? [];

  const expand = (id: string) => setOpenReplies((set) => new Set(set).add(id));

  const reply = (target: ReplyTarget) => {
    setReplyTo(target);
    // On cite l'auteur auquel on répond (les réponses restent sur un niveau).
    const mention = `@${target.username} `;
    setDraft((text) => (text.startsWith(mention) ? text : mention + text.replace(/^@[a-z0-9_.]+ /, "")));
    inputRef.current?.focus();
  };

  return (
    <section id="commentaires" className={styles.comments} aria-labelledby="commentaires-titre">
      <header className={styles.commentsHeader}>
        <h2 id="commentaires-titre" className={styles.commentsTitle}>
          Commentaires
        </h2>
        {post.counters.comments > 0 && <span className={styles.count}>{compactNumber(post.counters.comments)}</span>}
      </header>

      {comments.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <Skeleton width={36} height={36} radius="50%" />
              <Skeleton height={64} radius={12} />
            </div>
          ))}
        </div>
      ) : comments.isError ? (
        <ErrorState error={comments.error} onRetry={() => comments.refetch()} title="Les commentaires n'ont pas pu être chargés" />
      ) : list.length === 0 ? (
        <p style={{ margin: "0 0 4px", color: "var(--bb-ink-muted)", fontSize: 14.5 }}>Aucun commentaire pour l&apos;instant. Lancez la discussion&nbsp;!</p>
      ) : (
        <ul className={styles.commentList}>
          {list.map((comment) => (
            <CommentItem key={comment.id} post={post} comment={comment} rootId={comment.id} onReply={reply}>
              <Replies post={post} root={comment} open={openReplies.has(comment.id)} onToggle={() => expand(comment.id)} onReply={reply} />
            </CommentItem>
          ))}
        </ul>
      )}

      {comments.hasNextPage && (
        <button
          type="button"
          className={cx(ui.button, ui.secondary, ui.block)}
          style={{ marginTop: 16 }}
          onClick={() => comments.fetchNextPage()}
          disabled={comments.isFetchingNextPage}
        >
          {comments.isFetchingNextPage ? "Chargement…" : "Commentaires plus anciens"}
        </button>
      )}

      <CommentInput
        post={post}
        replyTo={replyTo}
        inputRef={inputRef}
        body={draft}
        setBody={setDraft}
        onCancelReply={() => {
          setReplyTo(null);
          setDraft((text) => text.replace(/^@[a-z0-9_.]+ /, ""));
        }}
        onSent={(rootId) => {
          if (rootId) expand(rootId);
          setReplyTo(null);
        }}
      />
    </section>
  );
}
