/** Couche service du domaine social : une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type { Ad, Comment, FeedPage, Post, ReactionType, ReportReason, Status, TrendingTag, Visibility } from "./types";

export interface CreatePostInput {
  kind: string;
  title?: string;
  body?: string;
  visibility?: Visibility;
  group?: string;
  payload?: Record<string, unknown>;
  media?: Array<{ file: string; alt: string }>;
  audience?: string[];
  poll?: { question: string; options: string[]; allows_multiple?: boolean; is_anonymous?: boolean; closes_at?: string };
}

export interface CreateStatusInput {
  kind: string;
  body?: string;
  visibility?: Visibility;
  file?: string;
  link_url?: string;
  style?: Record<string, unknown>;
  audience?: string[];
}

export const socialApi = {
  feed: (before?: number | null) => authed<FeedPage>(`/feed/?limit=20${before ? `&before=${before}` : ""}`),
  post: (id: string) => authed<Post>(`/posts/${id}/`),
  createPost: (input: CreatePostInput) => authed<Post>("/posts/", { method: "POST", body: input }),
  editPost: (id: string, body: string) => authed<Post>(`/posts/${id}/`, { method: "PATCH", body: { body } }),
  deletePost: (id: string) => authed<void>(`/posts/${id}/`, { method: "DELETE" }),
  react: (id: string, type: ReactionType | null) => authed<{ reaction: ReactionType | null }>(`/posts/${id}/reactions/`, { method: "POST", body: { type } }),
  save: (id: string) => authed(`/posts/${id}/save/`, { method: "POST", body: {} }),
  unsave: (id: string) => authed<void>(`/posts/${id}/save/`, { method: "DELETE" }),
  share: (id: string, comment: string, visibility: Visibility) => authed<{ id: string }>(`/posts/${id}/share/`, { method: "POST", body: { comment, visibility } }),
  view: (id: string) => authed(`/posts/${id}/view/`, { method: "POST", body: {} }),
  vote: (id: string, options: string[]) => authed(`/posts/${id}/poll/vote/`, { method: "POST", body: { options } }),
  saved: (path = "/me/saved/") => authed<Page<Post>>(path),
  hashtag: (tag: string, path?: string) => authed<Page<Post>>(path ?? `/hashtags/${encodeURIComponent(tag)}/posts/`),
  trending: () => authed<TrendingTag[]>("/hashtags/trending/"),

  comments: (postId: string, path?: string) => authed<Page<Comment>>(path ?? `/posts/${postId}/comments/`),
  replies: (commentId: string, path?: string) => authed<Page<Comment>>(path ?? `/comments/${commentId}/replies/`),
  addComment: (postId: string, body: string, parent?: string) =>
    authed<Comment>(`/posts/${postId}/comments/`, { method: "POST", body: parent ? { body, parent } : { body } }),
  deleteComment: (id: string) => authed<void>(`/comments/${id}/`, { method: "DELETE" }),
  reactComment: (id: string, type: ReactionType | null) => authed(`/comments/${id}/reactions/`, { method: "POST", body: { type } }),

  statuses: () => authed<Status[]>("/statuses/"),
  createStatus: (input: CreateStatusInput) => authed<Status>("/statuses/", { method: "POST", body: input }),
  viewStatus: (id: string) => authed(`/statuses/${id}/view/`, { method: "POST", body: {} }),
  reactStatus: (id: string, emoji: string) => authed(`/statuses/${id}/react/`, { method: "POST", body: { emoji } }),

  reportReasons: () => authed<ReportReason[]>("/reports/reasons/"),
  report: (targetType: "post" | "comment", targetId: string, reason: string, details: string) =>
    authed("/reports/", { method: "POST", body: { target_type: targetType, target_id: targetId, reason, details } }),

  ads: (placement: "feed" | "sidebar", limit = 1) => authed<Ad[]>(`/ads/serve/?placement=${placement}&limit=${limit}`),
  adImpression: (ad: string, placement: string, impressionId: string) =>
    authed("/ads/impressions/", { method: "POST", body: { ad, placement, impression_id: impressionId } }),
  adClick: (impressionId: string) => authed<{ counted: boolean; destination_url: string | null }>("/ads/clicks/", { method: "POST", body: { impression_id: impressionId } }),
};
