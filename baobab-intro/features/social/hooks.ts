"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import { socialApi, type CreatePostInput, type CreateStatusInput } from "./api";
import type { Comment, FeedPage, Post, ReactionType, Status, Visibility } from "./types";

export const keys = {
  feed: ["feed"] as const,
  post: (id: string) => ["post", id] as const,
  comments: (id: string) => ["comments", id] as const,
  replies: (id: string) => ["replies", id] as const,
  statuses: ["statuses"] as const,
  saved: ["saved"] as const,
  hashtag: (tag: string) => ["hashtag", tag] as const,
  trending: ["trending"] as const,
};

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export function useFeed() {
  return useInfiniteQuery({
    queryKey: keys.feed,
    queryFn: ({ pageParam }) => socialApi.feed(pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last: FeedPage) => (last.results.length > 0 ? last.next_cursor : null),
    staleTime: 30_000,
  });
}

function usePagedPosts(key: readonly unknown[], first: () => Promise<Page<Post>>, next: (path: string) => Promise<Page<Post>>) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => (pageParam ? next(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Post>) => nextPath(last.next),
  });
}

export const useSaved = () => usePagedPosts(keys.saved, () => socialApi.saved(), (path) => socialApi.saved(path));
export const useHashtag = (tag: string) =>
  usePagedPosts(keys.hashtag(tag), () => socialApi.hashtag(tag), (path) => socialApi.hashtag(tag, path));

export function usePost(id: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.post(id),
    queryFn: () => socialApi.post(id),
    // Affichage immédiat depuis le fil si la publication y est déjà (puis version complète).
    placeholderData: () => findPost(client, id),
  });
}

export function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: keys.comments(postId),
    queryFn: ({ pageParam }) => socialApi.comments(postId, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Comment>) => nextPath(last.next),
  });
}

export function useReplies(commentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: keys.replies(commentId),
    queryFn: ({ pageParam }) => socialApi.replies(commentId, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<Comment>) => nextPath(last.next),
    enabled,
  });
}

export function useStatuses() {
  return useQuery({ queryKey: keys.statuses, queryFn: socialApi.statuses, staleTime: 60_000 });
}

export function useTrending() {
  return useQuery({ queryKey: keys.trending, queryFn: socialApi.trending, staleTime: 10 * 60_000 });
}

/* ------------------------------------------------------------------ */
/* Cache : une publication peut apparaître à plusieurs endroits         */
/* ------------------------------------------------------------------ */

type PostLists = InfiniteData<FeedPage | Page<Post>>;

function findPost(client: QueryClient, id: string): Post | undefined {
  for (const [, data] of client.getQueriesData<PostLists>({ predicate: (q) => ["feed", "saved", "hashtag"].includes(q.queryKey[0] as string) })) {
    for (const page of data?.pages ?? []) {
      if (!page?.results) continue;
      const found = page.results.find((p) => p.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Applique une modification à la publication partout où elle est en cache (fil, détail, listes). */
export function patchPost(client: QueryClient, id: string, update: (post: Post) => Post | null) {
  client.setQueryData<Post>(keys.post(id), (post) => (post ? (update(post) ?? post) : post));
  client.setQueriesData<PostLists>({ predicate: (q) => ["feed", "saved", "hashtag"].includes(q.queryKey[0] as string) }, (data) =>
    data?.pages
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.flatMap((post) => {
              if (post.id !== id) return [post];
              const next = update(post);
              return next ? [next] : [];
            }),
          })),
        }
      : data,
  );
}

/* ------------------------------------------------------------------ */
/* Écritures optimistes (seuil de Doherty : réponse visuelle immédiate) */
/* ------------------------------------------------------------------ */

export function useReact(post: Post) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (type: ReactionType | null) => socialApi.react(post.id, type),
    onMutate: (type) => {
      const before = post.my_reaction ?? null;
      const delta = (type ? 1 : 0) - (before ? 1 : 0);
      patchPost(client, post.id, (p) => ({ ...p, my_reaction: type, counters: { ...p.counters, reactions: Math.max(0, p.counters.reactions + delta) } }));
      return { before, delta };
    },
    onError: (_error, _type, context) => {
      if (!context) return;
      patchPost(client, post.id, (p) => ({ ...p, my_reaction: context.before, counters: { ...p.counters, reactions: Math.max(0, p.counters.reactions - context.delta) } }));
    },
  });
}

export function useToggleSave(post: Post) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (save: boolean) => (save ? socialApi.save(post.id) : socialApi.unsave(post.id)),
    onMutate: (save) => {
      patchPost(client, post.id, (p) => ({ ...p, saved: save, counters: { ...p.counters, saves: Math.max(0, p.counters.saves + (save ? 1 : -1)) } }));
    },
    onError: (_error, save) => {
      patchPost(client, post.id, (p) => ({ ...p, saved: !save, counters: { ...p.counters, saves: Math.max(0, p.counters.saves + (save ? -1 : 1)) } }));
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.saved }),
  });
}

export function useShare(post: Post) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ comment, visibility }: { comment: string; visibility: Visibility }) => socialApi.share(post.id, comment, visibility),
    // Partage idempotent côté serveur (un partage par membre) : on relit le compteur plutôt que de le deviner.
    onSuccess: () => client.invalidateQueries({ queryKey: keys.post(post.id) }),
  });
}

export function useVote(post: Post) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (options: string[]) => socialApi.vote(post.id, options),
    onMutate: (options) => {
      patchPost(client, post.id, (p) =>
        p.poll
          ? {
              ...p,
              poll: {
                ...p.poll,
                my_votes: options,
                total_votes: p.poll.total_votes + options.length,
                options: p.poll.options.map((o) => (options.includes(o.id) ? { ...o, votes: o.votes + 1 } : o)),
              },
            }
          : p,
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.post(post.id) }),
    onError: () => client.invalidateQueries({ queryKey: keys.feed }),
  });
}

export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => socialApi.createPost(input),
    onSuccess: (post) => {
      // La nouvelle publication apparaît tout de suite en tête du fil.
      client.setQueryData<InfiniteData<FeedPage>>(keys.feed, (data) =>
        data ? { ...data, pages: data.pages.map((page, i) => (i === 0 ? { ...page, results: [post, ...page.results] } : page)) } : data,
      );
    },
  });
}

export function useEditPost(post: Post) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => socialApi.editPost(post.id, body),
    onSuccess: (updated) => {
      // Le fil garde un extrait de 500 caractères, comme le serveur.
      patchPost(client, post.id, (p) => ({ ...p, body: updated.body.slice(0, 500), edited_at: updated.edited_at }));
      client.setQueryData(keys.post(post.id), updated);
    },
  });
}

export function useDeletePost(post: Post) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => socialApi.deletePost(post.id),
    onSuccess: () => {
      patchPost(client, post.id, () => null);
      client.removeQueries({ queryKey: keys.post(post.id) });
    },
  });
}

export function useAddComment(postId: string, parent?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => socialApi.addComment(postId, body, parent),
    onSuccess: (comment) => {
      const key = parent ? keys.replies(parent) : keys.comments(postId);
      client.setQueryData<InfiniteData<Page<Comment>>>(key, (data) =>
        data
          ? { ...data, pages: data.pages.map((page, i) => (i === 0 ? { ...page, results: parent ? [...page.results, comment] : [comment, ...page.results] } : page)) }
          : data,
      );
      if (parent) {
        client.setQueryData<InfiniteData<Page<Comment>>>(keys.comments(postId), (data) =>
          data
            ? { ...data, pages: data.pages.map((page) => ({ ...page, results: page.results.map((c) => (c.id === parent ? { ...c, replies: c.replies + 1 } : c)) })) }
            : data,
        );
      }
      patchPost(client, postId, (p) => ({ ...p, counters: { ...p.counters, comments: p.counters.comments + 1 } }));
    },
  });
}

export function useDeleteComment(postId: string, comment: Comment) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => socialApi.deleteComment(comment.id),
    onSuccess: () => {
      for (const key of [keys.comments(postId), ...(comment.parent ? [keys.replies(comment.parent)] : [])]) {
        client.setQueryData<InfiniteData<Page<Comment>>>(key, (data) =>
          data ? { ...data, pages: data.pages.map((page) => ({ ...page, results: page.results.filter((c) => c.id !== comment.id) })) } : data,
        );
      }
      patchPost(client, postId, (p) => ({ ...p, counters: { ...p.counters, comments: Math.max(0, p.counters.comments - 1) } }));
    },
  });
}

/** Réagir à un commentaire (ou retirer sa réaction), mise à jour immédiate de la liste. */
export function useReactComment(postId: string, comment: Comment) {
  const client = useQueryClient();
  const listKey = comment.parent ? keys.replies(comment.parent) : keys.comments(postId);
  const patch = (type: ReactionType | null, delta: number) =>
    client.setQueryData<InfiniteData<Page<Comment>>>(listKey, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              results: page.results.map((c) => (c.id === comment.id ? { ...c, my_reaction: type, reactions: Math.max(0, c.reactions + delta) } : c)),
            })),
          }
        : data,
    );
  return useMutation({
    mutationFn: (type: ReactionType | null) => socialApi.reactComment(comment.id, type),
    onMutate: (type) => {
      const before = comment.my_reaction ?? null;
      const delta = (type ? 1 : 0) - (before ? 1 : 0);
      patch(type, delta);
      return { before, delta };
    },
    onError: (_error, _type, context) => context && patch(context.before, -context.delta),
  });
}

export function useCreateStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStatusInput) => socialApi.createStatus(input),
    onSuccess: (status) =>
      client.setQueryData<Status[]>(keys.statuses, (list) => [...(list ?? []), { ...status, viewed: true }]),
  });
}

export function markStatusViewed(client: QueryClient, id: string) {
  client.setQueryData<Status[]>(keys.statuses, (list) => list?.map((s) => (s.id === id ? { ...s, viewed: true } : s)));
}
