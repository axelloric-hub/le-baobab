"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/features/me/me";
import {
  markConversationRead,
  msgKeys,
  refreshLatest,
  useDeleteMessage,
  useEditMessage,
  useHistory,
  useInbox,
  useReactMessage,
  useSendMessage,
} from "@/features/messaging/hooks";
import type { Message, SendInput } from "@/features/messaging/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { openSocket, type SocketHandle } from "@/lib/realtime/socket";
import { ROUTES } from "@/lib/routes";
import { cx } from "../ui/cx";
import { ArrowDownIcon, ArrowLeftIcon, LockIcon } from "../ui/icons";
import { EmptyState, ErrorState, Spinner } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { useVisualViewport } from "../ui/use-visual-viewport";
import { ConversationAvatar } from "./ConversationList";
import { dayLabel } from "./labels";
import { MessageComposer } from "./MessageComposer";
import { MessageRow } from "./MessageRow";
import styles from "./Messages.module.css";

const GROUP_GAP_MS = 5 * 60_000;
const TYPING_MS = 4000;

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** Conversation : en-tête, fil (temps réel), saisie. */
export function ConversationView({ id }: { id: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const myUsername = me.data?.username ?? currentUser()?.username ?? "";
  const inbox = useInbox();
  const history = useHistory(id);
  const send = useSendMessage(id);
  const react = useReactMessage(id);
  const edit = useEditMessage(id);
  const remove = useDeleteMessage(id);
  const paneRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const socket = useRef<SocketHandle | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typing, setTyping] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [fresh, setFresh] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);

  const conversation = inbox.data?.find((c) => c.id === id);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  useVisualViewport(paneRef, isMobile);

  // Messages du plus récent au plus ancien (ordre de l'API), affichés en colonne inversée.
  const messages = useMemo(() => history.data?.pages.flatMap((p) => p.results) ?? [], [history.data]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const latestSeq = messages.find((m) => !m.local)?.seq ?? 0;
  const latestId = messages[0]?.id;

  /** Mes messages : l'expéditeur des bulles optimistes est « moi ». */
  const isMine = useCallback((m: Message) => Boolean(m.local) || m.sender?.username === myUsername, [myUsername]);

  // Temps réel : nouveaux messages et « en train d'écrire ».
  useEffect(() => {
    const handle = openSocket(`/ws/conversations/${id}/`, (data) => {
      const event = data as { type?: string };
      if (event.type === "message") {
        void refreshLatest(client, id);
        void client.invalidateQueries({ queryKey: msgKeys.inbox });
        setTyping(false);
      } else if (event.type === "typing") {
        setTyping(true);
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), TYPING_MS);
      }
    });
    socket.current = handle;
    return () => {
      handle.close();
      socket.current = null;
      window.clearTimeout(typingTimer.current);
    };
  }, [id, client]);

  // Lecture : en bas du fil et onglet visible → marqué comme lu.
  useEffect(() => {
    if (!latestSeq || !atBottom) return;
    const mark = () => document.visibilityState === "visible" && markConversationRead(client, id, latestSeq);
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [latestSeq, atBottom, client, id]);

  // Nouveau message reçu pendant qu'on lit plus haut : pastille au lieu de faire sauter l'écran.
  const lastSeen = useRef(latestId);
  useEffect(() => {
    if (!latestId || latestId === lastSeen.current) return;
    const newest = messages[0];
    if (!atBottom && newest && !isMine(newest)) setFresh((n) => n + 1);
    if (atBottom || (newest && isMine(newest))) scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    lastSeen.current = latestId;
  }, [latestId, atBottom, messages, isMine]);

  // Historique : chargé quand on remonte en haut du fil.
  useEffect(() => {
    const node = topRef.current;
    if (!node || !history.hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && !history.isFetchingNextPage && history.fetchNextPage(), {
      root: scrollerRef.current,
      rootMargin: "400px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [history]);

  const onScroll = () => {
    const node = scrollerRef.current;
    if (!node) return;
    // Colonne inversée : 0 = tout en bas (valeurs négatives en remontant).
    const bottom = Math.abs(node.scrollTop) < 48;
    setAtBottom(bottom);
    if (bottom) setFresh(0);
  };

  const sendInput = useCallback(
    (input: Omit<SendInput, "client_msg_id">, clientId: string = crypto.randomUUID()) => {
      send.mutate({ ...input, client_msg_id: clientId });
      setReplyTo(null);
    },
    [send],
  );

  const onReply = useCallback((m: Message) => {
    setEditing(null);
    setReplyTo(m);
  }, []);
  const onReact = useCallback((m: Message, emoji: string) => react.mutate({ message: m, emoji }), [react]);
  const onEdit = useCallback((m: Message) => {
    setReplyTo(null);
    setEditing(m);
  }, []);
  const onDelete = useCallback(
    (m: Message, forEveryone: boolean) =>
      remove.mutate(
        { messageId: m.id, forEveryone },
        {
          onSuccess: () => toast(forEveryone ? "Message supprimé pour tout le monde." : "Message supprimé pour vous.", { tone: "success" }),
          onError: (e) => toast(describeError(e), { tone: "error" }),
        },
      ),
    [remove, toast],
  );
  const onRetry = useCallback(
    (m: Message) => {
      if (!m.local) return;
      // Même identifiant client : le serveur ne crée pas de doublon si le premier envoi était passé.
      send.mutate(m.local.input);
    },
    [send],
  );
  const onCopy = useCallback(
    (m: Message) =>
      navigator.clipboard.writeText(m.body).then(
        () => toast("Texte copié.", { tone: "success" }),
        () => toast("Impossible de copier sur cet appareil.", { tone: "error" }),
      ),
    [toast],
  );
  const onJump = useCallback((messageId: string) => {
    const node = document.getElementById(`message-${messageId}`);
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(messageId);
    window.setTimeout(() => setHighlight(null), 1400);
  }, []);

  if (history.isError) {
    const notFound = history.error instanceof ApiError && history.error.status === 404;
    return (
      <section className={styles.threadPane} ref={paneRef}>
        <div className={styles.threadHead}>
          <button type="button" className={cx(ui.iconButton, styles.back)} onClick={() => router.push("/messages")} aria-label="Retour aux conversations">
            <ArrowLeftIcon />
          </button>
        </div>
        <div className={styles.placeholder}>
          {notFound ? (
            <EmptyState icon={<LockIcon />} title="Conversation introuvable" text="Elle n'existe pas ou vous n'en faites plus partie." />
          ) : (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          )}
        </div>
      </section>
    );
  }

  const other = conversation?.with ?? null;
  const title = conversation?.title || other?.display_name || "Conversation";
  const isGroup = conversation?.type === "group";
  const readSeq = isGroup ? null : conversation?.others_read_seq;
  const subtitle = typing
    ? isGroup
      ? "Quelqu'un écrit…"
      : "écrit…"
    : isGroup
      ? "Groupe"
      : other?.online
        ? "En ligne"
        : other
          ? `@${other.username}`
          : "";

  // Rendu : chronologique pour calculer les regroupements, puis inversé pour la colonne inversée.
  const chrono = [...messages].reverse();
  const rows = chrono.map((m, i) => {
    const prev = chrono[i - 1];
    const next = chrono[i + 1];
    const author = (x?: Message) => (x ? (isMine(x) ? "__me__" : x.sender?.username) : undefined);
    const newDay = !prev || !sameDay(prev.created_at, m.created_at);
    const first = newDay || author(prev) !== author(m) || new Date(m.created_at).getTime() - new Date(prev!.created_at).getTime() > GROUP_GAP_MS;
    const lastOfGroup = !next || author(next) !== author(m) || !sameDay(next.created_at, m.created_at) || new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > GROUP_GAP_MS;
    return { m, newDay, first, last: lastOfGroup };
  });

  return (
    <section className={styles.threadPane} ref={paneRef} aria-label={`Conversation avec ${title}`}>
      <header className={styles.threadHead}>
        <button type="button" className={cx(ui.iconButton, styles.back)} onClick={() => router.push("/messages")} aria-label="Retour aux conversations">
          <ArrowLeftIcon />
        </button>
        {conversation ? (
          other && !isGroup ? (
            <Link href={ROUTES.profile(other.username)} className={styles.peer}>
              <ConversationAvatar conversation={conversation} size={40} />
              <span className={styles.peerText}>
                <span className={styles.peerName}>{title}</span>
                <span className={styles.peerSub} data-online={(!typing && other.online) || undefined} data-typing={typing || undefined} aria-live="polite">
                  {subtitle}
                </span>
              </span>
            </Link>
          ) : (
            <span className={styles.peer}>
              <ConversationAvatar conversation={conversation} size={40} />
              <span className={styles.peerText}>
                <span className={styles.peerName}>{title}</span>
                <span className={styles.peerSub} data-typing={typing || undefined} aria-live="polite">
                  {subtitle}
                </span>
              </span>
            </span>
          )
        ) : (
          <span className={styles.peer}>
            <Spinner />
          </span>
        )}
      </header>

      <div ref={scrollerRef} className={styles.scroller} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages">
        {typing && (
          <span className={styles.typing} aria-label="En train d'écrire">
            <span />
            <span />
            <span />
          </span>
        )}
        {[...rows].reverse().map(({ m, newDay, first, last }) => (
          <Fragment key={m.id}>
            <MessageRow
              message={m}
              mine={isMine(m)}
              first={first}
              last={last}
              showSender={isGroup}
              quoted={m.reply_to ? byId.get(m.reply_to) : undefined}
              readSeq={readSeq}
              highlight={highlight === m.id}
              onReply={onReply}
              onReact={onReact}
              onEdit={onEdit}
              onDelete={onDelete}
              onRetry={onRetry}
              onJump={onJump}
              onCopy={onCopy}
            />
            {newDay && (
              <div className={styles.dayRow}>
                <span className={styles.day}>{dayLabel(m.created_at)}</span>
              </div>
            )}
          </Fragment>
        ))}
        {history.isPending && (
          <div className={styles.loadingOlder}>
            <Spinner label="Chargement des messages" />
          </div>
        )}
        {history.isFetchingNextPage && (
          <div className={styles.loadingOlder}>
            <Spinner label="Chargement des messages plus anciens" />
          </div>
        )}
        {!history.isPending && !history.hasNextPage && (
          <p className={styles.start}>
            {messages.length === 0 ? "Aucun message pour l'instant. Écrivez le premier !" : "Début de la conversation."} Les messages sont visibles uniquement par les membres de cette
            conversation.
          </p>
        )}
        <div ref={topRef} aria-hidden="true" style={{ minHeight: 1 }} />
      </div>

      {fresh > 0 && (
        <button
          type="button"
          className={styles.newPill}
          onClick={() => {
            scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            setFresh(0);
          }}
        >
          <ArrowDownIcon aria-hidden="true" />
          {fresh === 1 ? "1 nouveau message" : `${fresh} nouveaux messages`}
        </button>
      )}

      <MessageComposer
        key={id}
        conversationId={id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={(input) => sendInput(input)}
        onTyping={() => socket.current?.send({ type: "typing" })}
        placeholder={isGroup ? "Écrire au groupe…" : other ? `Écrire à ${other.display_name.split(" ")[0] || other.username}…` : "Écrire un message…"}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={(body) => {
          if (!editing) return;
          edit.mutate(
            { messageId: editing.id, body },
            {
              onSuccess: () => setEditing(null),
              onError: (e) => toast(describeError(e), { tone: "error" }),
            },
          );
        }}
      />
    </section>
  );
}
