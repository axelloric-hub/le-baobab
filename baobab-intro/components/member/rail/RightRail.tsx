"use client";

import Link from "next/link";
import { BRAND } from "@/components/landing/landing-content";
import { useTrending } from "@/features/social/hooks";
import {
  useClassroomInvitations,
  useGroupInvitations,
  useJoinGroup,
  useRespondInvitation,
  useSuggestedGroups,
  type ClassroomInvitation,
  type GroupInvitation,
} from "@/features/sidebar/hooks";
import { describeError } from "@/lib/api/errors";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { AdSlot } from "../feed/AdSlot";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { ChevronRightIcon, CommunityIcon, HubIcon, TrendingIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Rail.module.css";

function InvitationItem({ invitation, kind }: { invitation: GroupInvitation | ClassroomInvitation; kind: "groups" | "classrooms" }) {
  const respond = useRespondInvitation(kind);
  const toast = useToast();
  const target = "group" in invitation ? invitation.group.name : invitation.classroom.title;
  const by = invitation.invited_by.display_name || invitation.invited_by.username;
  const answer = (accept: boolean) =>
    respond.mutate(
      { id: invitation.id, accept },
      {
        onSuccess: () => toast(accept ? `Vous avez rejoint « ${target} ».` : "Invitation déclinée.", { tone: "success" }),
        onError: (error) => toast(describeError(error), { tone: "error" }),
      },
    );
  return (
    <li className={styles.invite}>
      <div className={styles.inviteHead}>
        <Avatar name={target} size={40} />
        <p className={styles.inviteText} style={{ margin: 0 }}>
          <strong>{by}</strong> vous invite à rejoindre <strong>{target}</strong>
          <span className={styles.inviteKind}>{kind === "groups" ? "Groupe" : "Classe Learn"}</span>
        </p>
      </div>
      <div className={styles.inviteActions}>
        <button type="button" className={cx(ui.button, ui.primary, ui.small)} onClick={() => answer(true)} disabled={respond.isPending}>
          Accepter
        </button>
        <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => answer(false)} disabled={respond.isPending}>
          Décliner
        </button>
      </div>
    </li>
  );
}

/** Invitations en attente (groupes et classes). Rien n'est affiché s'il n'y en a pas. */
export function InvitationsCard() {
  const groups = useGroupInvitations();
  const classrooms = useClassroomInvitations();
  const total = (groups.data?.length ?? 0) + (classrooms.data?.length ?? 0);
  if (total === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="rail-invitations">
      <div className={styles.head}>
        <h2 id="rail-invitations" className={styles.title}>
          <HubIcon aria-hidden="true" />
          Invitations
        </h2>
        <span className={styles.count} aria-label={plural(total, "invitation", "invitations")}>
          {total}
        </span>
      </div>
      <ul className={styles.list}>
        {groups.data?.map((invitation) => <InvitationItem key={invitation.id} invitation={invitation} kind="groups" />)}
        {classrooms.data?.map((invitation) => <InvitationItem key={invitation.id} invitation={invitation} kind="classrooms" />)}
      </ul>
    </section>
  );
}

function TrendsCard() {
  const trending = useTrending();
  const items = (trending.data ?? []).slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="rail-tendances">
      <div className={styles.head}>
        <h2 id="rail-tendances" className={styles.title}>
          <TrendingIcon aria-hidden="true" />
          Tendances de la semaine
        </h2>
      </div>
      <ol className={styles.list} style={{ gap: 2 }}>
        {items.map((item, index) => (
          <li key={item.tag}>
            <Link href={ROUTES.hashtag(item.tag)} className={styles.trend}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.trendText}>
                <span className={styles.trendTag}>#{item.tag}</span>
                <span className={styles.trendMeta}>
                  {plural(item.posts_7d, "publication", "publications")} · {plural(item.authors_7d, "auteur", "auteurs")}
                </span>
              </span>
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SuggestedGroupsCard() {
  const groups = useSuggestedGroups();
  const join = useJoinGroup();
  const toast = useToast();
  if (!groups.data || groups.data.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="rail-groupes">
      <div className={styles.head}>
        <h2 id="rail-groupes" className={styles.title}>
          <CommunityIcon aria-hidden="true" />
          Groupes à découvrir
        </h2>
      </div>
      <ul className={styles.list} style={{ gap: 14 }}>
        {groups.data.map((group) => {
          const joined = Boolean(group.my_role);
          const pending = group.my_request_pending;
          return (
            <li key={group.slug} className={styles.group}>
              <Avatar name={group.name} src={group.avatar_url} size={40} />
              <span className={styles.groupText}>
                <span className={styles.groupName}>{group.name}</span>
                <span className={styles.groupMeta}>{plural(group.member_count, "membre", "membres")}</span>
              </span>
              <button
                type="button"
                className={cx(ui.button, joined || pending ? ui.ghost : ui.secondary, ui.small)}
                disabled={joined || pending || join.isPending}
                onClick={() =>
                  join.mutate(group.slug, {
                    onSuccess: (result) =>
                      toast(result.status === "joined" ? `Bienvenue dans « ${group.name} ».` : "Demande envoyée aux modérateurs du groupe.", { tone: "success" }),
                    onError: (error) => toast(describeError(error), { tone: "error" }),
                  })
                }
              >
                {joined ? "Membre" : pending ? "Demandé" : group.join_policy === "open" ? "Rejoindre" : "Demander"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Colonne de droite du fil (ordinateur). Chaque bloc n'apparaît que s'il a du contenu réel. */
export function RightRail() {
  return (
    <>
      <InvitationsCard />
      <TrendsCard />
      <SuggestedGroupsCard />
      <AdSlot placement="sidebar" />
      <p className={styles.footer}>
        <Link href="/docs">Documentation</Link> · <Link href="/blog">Blog</Link> · <Link href="/communaute">Communauté</Link> ·{" "}
        <Link href={ROUTES.discover} prefetch={false}>
          À propos
        </Link>
        <br />© {new Date().getFullYear()} {BRAND.name}
      </p>
    </>
  );
}
