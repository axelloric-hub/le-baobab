/** Groupes et communautés (apps/community). */
import type { UserBrief } from "@/features/social/types";

export type GroupPrivacy = "public" | "private" | "hidden";
export type JoinPolicy = "open" | "approval" | "invite_only";

/** Permissions d'un rôle dans un groupe (apps/community/constants.py). */
export type GroupPermission =
  | "post.create"
  | "post.delete_any"
  | "comment.create"
  | "member.invite"
  | "member.approve"
  | "member.mute"
  | "member.ban"
  | "role.manage"
  | "group.edit"
  | "channel.manage";

export interface Group {
  slug: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  join_policy: JoinPolicy;
  member_count: number;
  avatar_url: string | null;
  cover_url: string | null;
  community: string | null;
  /** owner | moderator | member | null (pas membre). */
  my_role: string | null;
  /** Vide pour un non-membre (champ ajouté au lot 3 : absent sur un serveur plus ancien). */
  my_permissions?: GroupPermission[];
  my_request_pending: boolean;
  created_at?: string;
}

export interface GroupMember extends UserBrief {
  role: string;
  joined_at: string;
}

export interface JoinRequest {
  id: string;
  user: UserBrief;
  message: string;
  created_at: string;
}

export interface Community {
  slug: string;
  name: string;
  description: string;
}

export interface CreateGroupInput {
  name: string;
  slug: string;
  description?: string;
  privacy: GroupPrivacy;
  join_policy: JoinPolicy;
  community?: string;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  join_policy?: JoinPolicy;
  avatar_file?: string | null;
  cover_file?: string | null;
}
