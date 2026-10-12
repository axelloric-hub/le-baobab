/** Formes des réponses de l'API sociale (apps/social/api.py). */

export interface UserBrief {
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export type Visibility = "public" | "followers" | "friends" | "close_friends" | "group_members" | "custom" | "private";

export type ReactionType = "like" | "love" | "celebrate" | "insightful" | "funny" | "support";

export type PostKind =
  | "text" | "image" | "video" | "link" | "code" | "repository" | "project" | "portfolio" | "event" | "job" | "course" | "poll";

export interface PostMedia {
  kind: "image" | "video" | "audio" | "file" | string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  question: string;
  allows_multiple: boolean;
  is_anonymous: boolean;
  closes_at: string | null;
  closed: boolean;
  options: PollOption[];
  total_votes: number;
  my_votes: string[];
}

export interface Counters {
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
}

/** Publication telle que l'affiche le frontend (carte du fil ou publication complète). */
export interface Post {
  id: string;
  author: UserBrief;
  kind: PostKind;
  title: string;
  body: string;
  visibility: Visibility;
  group?: string | null;
  group_name?: string | null;
  payload: Record<string, unknown> | null;
  published_at: string;
  edited_at?: string | null;
  media: PostMedia[];
  hashtags?: string[];
  counters: Counters;
  /** Absent des anciennes versions de l'API : traité comme inconnu. */
  my_reaction?: ReactionType | null;
  saved?: boolean;
  poll?: Poll | null;
}

export interface FeedPage {
  results: Post[];
  next_cursor: number | null;
}

export interface Comment {
  id: string;
  author: UserBrief;
  body: string;
  parent: string | null;
  depth: number;
  reactions: number;
  replies: number;
  created_at: string;
  /** Ma réaction (absent des anciennes versions de l'API). */
  my_reaction?: ReactionType | null;
}

export type StatusKind = "text" | "image" | "video" | "audio" | "link" | "document";

export interface Status {
  id: string;
  author: UserBrief;
  kind: StatusKind;
  body: string;
  media_url: string | null;
  mime_type: string;
  link_url: string;
  style: { background?: string } | null;
  visibility?: Visibility;
  expires_at: string;
  created_at: string;
  viewed?: boolean;
}

export interface TrendingTag {
  tag: string;
  posts_7d: number;
  authors_7d: number;
}

export interface ReportReason {
  code: string;
  label: string;
}

export interface Ad {
  id: string;
  headline: string;
  body: string;
  cta_label: string;
  destination_url: string;
  media_url: string | null;
  impression_id: string;
}
