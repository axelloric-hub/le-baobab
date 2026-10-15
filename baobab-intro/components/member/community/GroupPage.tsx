"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { canInGroup, useGroup, useGroupMembers, useGroupPosts, useJoinRequests, useLeave, useReviewRequest } from "@/features/community/hooks";
import type { Group, GroupMember } from "@/features/community/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { plural, relativeTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { PostList } from "../feed/PostList";
import { ConfirmDialog } from "../post/PostDialogs";
import { useCreation } from "../shell/creation-context";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import {
  ArrowLeftIcon,
  BlockIcon,
  CalendarIcon,
  CommentIcon,
  CommunityIcon,
  CopyIcon,
  GlobeIcon,
  LockIcon,
  LogoutIcon,
  MoreIcon,
  MuteIcon,
  PenIcon,
  SettingsIcon,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "../ui/icons";
import { Menu, type MenuEntry } from "../ui/Menu";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Community.module.css";
import { PrivacyBadge } from "./GroupCard";
import { EditGroupDialog, InviteDialog, ModerateDialog } from "./GroupDialogs";
import { JoinButton } from "./JoinButton";
import { JOIN_POLICY, PRIVACY, roleLabel } from "./labels";

const TAB_IDS = ["publications", "membres", "demandes", "a-propos"] as const;
type Tab = (typeof TAB_IDS)[number];

const MONTH_YEAR = new Intl.DateTimeFormat("fr", { month: "long", year: "numeric" });

/* ------------------------------------------------------------------ */
/* En-tête                                                             */
/* ------------------------------------------------------------------ */

function GroupHeader({ group, onEdit, onInvite }: { group: Group; onEdit: () => void; onInvite: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const leave = useLeave();
  const { openPost } = useCreation();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isMember = Boolean(group.my_role);
  const isOwner = group.my_role === "owner";

  const copyLink = () =>
    navigator.clipboard.writeText(`${window.location.origin}${ROUTES.group(group.slug)}`).then(
      () => toast("Lien du groupe copié.", { tone: "success" }),
      () => toast("Impossible de copier sur cet appareil.", { tone: "error" }),
    );

  const menu: MenuEntry[] = [
    { label: "Copier le lien du groupe", icon: <CopyIcon />, onSelect: copyLink },
    ...(canInGroup(group, "group.edit") ? [{ label: "Modifier le groupe", icon: <SettingsIcon />, onSelect: onEdit }] : []),
    ...(isMember && !isOwner
      ? [{ kind: "separator" as const }, { label: "Quitter le groupe", icon: <LogoutIcon />, tone: "danger" as const, onSelect: () => setConfirmLeave(true) }]
      : []),
  ];

  return (
    <header className={styles.header}>
      <div className={styles.cover}>
        {group.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img src={group.cover_url} alt="" />
        )}
      </div>
      <div className={styles.identity}>
        <div className={styles.avatarRow}>
          <span className={styles.avatarRing}>
            <Avatar name={group.name} src={group.avatar_url} size={96} />
          </span>
          <div className={styles.actions}>
            {isMember && canInGroup(group, "post.create") && (
              <button type="button" className={cx(ui.button, ui.primary)} onClick={() => openPost(undefined, { slug: group.slug, name: group.name, privacy: group.privacy })}>
                <PenIcon />
                Publier
              </button>
            )}
            {isMember && canInGroup(group, "member.invite") && (
              <button type="button" className={cx(ui.button, ui.secondary)} onClick={onInvite}>
                <UserPlusIcon />
                Inviter
              </button>
            )}
            {!isMember && <JoinButton group={group} />}
            <Menu label="Actions du groupe" items={menu} trigger={<MoreIcon />} />
          </div>
        </div>
        <div>
          <h1 className={styles.name}>{group.name}</h1>
        </div>
        <ul className={styles.meta}>
          <li>
            <PrivacyBadge privacy={group.privacy} />
          </li>
          <li>
            <UsersIcon aria-hidden="true" />
            {plural(group.member_count, "membre", "membres")}
          </li>
          {group.my_role && (
            <li>
              <UserCheckIcon aria-hidden="true" />
              Vous êtes {roleLabel(group.my_role).toLowerCase()}
            </li>
          )}
        </ul>
        {group.description && <p className={styles.description}>{group.description}</p>}
      </div>

      <ConfirmDialog
        open={confirmLeave}
        busy={leave.isPending}
        onClose={() => setConfirmLeave(false)}
        title={`Quitter « ${group.name} » ?`}
        text={
          group.join_policy === "open"
            ? "Vous ne verrez plus ses publications dans votre fil. Vous pourrez revenir quand vous voulez."
            : "Vous ne verrez plus ses publications. Pour revenir, il faudra une nouvelle approbation ou une invitation."
        }
        confirm="Quitter"
        onConfirm={() =>
          leave.mutate(group.slug, {
            onSuccess: () => {
              setConfirmLeave(false);
              toast(`Vous avez quitté « ${group.name} ».`, { tone: "success" });
              if (group.privacy !== "public") router.push(ROUTES.groups);
            },
            onError: (error) => toast(describeError(error), { tone: "error" }),
          })
        }
      />
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Onglets                                                             */
/* ------------------------------------------------------------------ */

function canSeeContent(group: Group) {
  return group.privacy === "public" || Boolean(group.my_role);
}

function LockedContent({ group }: { group: Group }) {
  return (
    <div className={styles.locked}>
      <EmptyState
        icon={<LockIcon />}
        title="Contenu réservé aux membres"
        text={`« ${group.name} » est un groupe privé : ses publications et ses membres ne sont visibles qu'après l'adhésion.`}
        actions={<JoinButton group={group} />}
      />
    </div>
  );
}

function PostsTab({ group }: { group: Group }) {
  const visible = canSeeContent(group);
  const posts = useGroupPosts(group.slug, visible);
  const { openPost } = useCreation();
  const list = useMemo(() => posts.data?.pages.flatMap((p) => p.results) ?? [], [posts.data]);
  if (!visible) return <LockedContent group={group} />;
  const canPost = Boolean(group.my_role) && canInGroup(group, "post.create");
  const target = { slug: group.slug, name: group.name, privacy: group.privacy };
  return (
    <>
      {canPost && (
        <div className={styles.panelCard} style={{ padding: 14 }}>
          <button
            type="button"
            className={ui.input}
            style={{ textAlign: "left", color: "var(--bb-ink-muted)", cursor: "text", borderRadius: 999 }}
            onClick={() => openPost(undefined, target)}
          >
            Partagez quelque chose avec le groupe…
          </button>
        </div>
      )}
      <PostList
        posts={list}
        isPending={posts.isPending}
        isError={posts.isError}
        error={posts.error}
        refetch={() => posts.refetch()}
        hasNextPage={posts.hasNextPage}
        isFetchingNextPage={posts.isFetchingNextPage}
        fetchNextPage={() => posts.fetchNextPage()}
        endLabel="Vous avez tout vu."
        empty={
          <EmptyState
            icon={<CommentIcon />}
            title="Aucune publication pour l'instant"
            text={canPost ? "Lancez la conversation : une question, un retour d'expérience, un projet." : "Les publications du groupe apparaîtront ici."}
            actions={
              canPost && (
                <button type="button" className={cx(ui.button, ui.primary)} onClick={() => openPost(undefined, target)}>
                  <PenIcon />
                  Publier dans le groupe
                </button>
              )
            }
          />
        }
      />
    </>
  );
}

function MemberRow({ group, member, onModerate }: { group: Group; member: GroupMember; onModerate: (kind: "ban" | "mute") => void }) {
  const me = currentUser()?.username;
  const isSelf = member.username === me;
  // Le serveur refuse d'agir sur un rang égal ou supérieur : on ne propose l'action qu'aux membres simples.
  const actionable = !isSelf && member.role === "member";
  const items: MenuEntry[] = [
    ...(canInGroup(group, "member.mute") ? [{ label: "Mettre en sourdine", icon: <MuteIcon />, onSelect: () => onModerate("mute") }] : []),
    ...(canInGroup(group, "member.ban") ? [{ label: "Bannir du groupe", icon: <BlockIcon />, tone: "danger" as const, onSelect: () => onModerate("ban") }] : []),
  ];
  return (
    <li className={styles.person}>
      <Avatar name={member.display_name || member.username} src={member.avatar_url} size={40} />
      <span className={styles.personText}>
        <Link href={ROUTES.profile(member.username)} className={styles.personName}>
          {member.display_name || member.username}
          {isSelf && " (vous)"}
        </Link>
        <span className={styles.personMeta}>
          @{member.username} · a rejoint {relativeTime(member.joined_at)}
        </span>
      </span>
      <span className={styles.personActions}>
        {member.role !== "member" && <span className={styles.role}>{roleLabel(member.role)}</span>}
        {actionable && items.length > 0 && <Menu label={`Modérer ${member.display_name || member.username}`} items={items} trigger={<MoreIcon />} />}
      </span>
    </li>
  );
}

function MembersTab({ group }: { group: Group }) {
  const visible = canSeeContent(group);
  const members = useGroupMembers(group.slug, visible);
  const [moderating, setModerating] = useState<{ member: GroupMember; kind: "ban" | "mute" } | null>(null);
  const list = useMemo(() => members.data?.pages.flatMap((p) => p.results) ?? [], [members.data]);
  if (!visible) return <LockedContent group={group} />;
  if (members.isPending) {
    return (
      <div className={styles.people} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.person}>
            <Skeleton width={40} height={40} radius="50%" />
            <Skeleton width="50%" height={14} />
          </div>
        ))}
      </div>
    );
  }
  if (members.isError) return <ErrorState error={members.error} onRetry={() => members.refetch()} />;
  return (
    <>
      <ul className={styles.people} aria-label={`Membres de ${group.name}`}>
        {list.map((member) => (
          <MemberRow key={member.username} group={group} member={member} onModerate={(kind) => setModerating({ member, kind })} />
        ))}
      </ul>
      {members.hasNextPage && (
        <div className={styles.more}>
          {members.isFetchingNextPage ? (
            <Spinner label="Chargement de la suite" />
          ) : (
            <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => members.fetchNextPage()}>
              Afficher plus de membres
            </button>
          )}
        </div>
      )}
      {moderating && <ModerateDialog group={group} member={moderating.member} kind={moderating.kind} onClose={() => setModerating(null)} />}
    </>
  );
}

function RequestsTab({ group }: { group: Group }) {
  const requests = useJoinRequests(group.slug, true);
  const review = useReviewRequest(group.slug);
  const toast = useToast();
  if (requests.isPending) return <Spinner label="Chargement des demandes" />;
  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => requests.refetch()} />;
  if (requests.data.length === 0) {
    return <EmptyState icon={<UserCheckIcon />} title="Aucune demande en attente" text="Les demandes d'adhésion apparaîtront ici. Elles sont aussi signalées par un compteur sur cet onglet." />;
  }
  return (
    <ul className={styles.people} aria-label="Demandes d'adhésion">
      {requests.data.map((request) => {
        const name = request.user.display_name || request.user.username;
        const answer = (approve: boolean) =>
          review.mutate(
            { id: request.id, approve },
            {
              onSuccess: () => toast(approve ? `${name} a rejoint le groupe.` : "Demande refusée.", { tone: "success" }),
              onError: (error) => toast(describeError(error), { tone: "error" }),
            },
          );
        return (
          <li key={request.id} className={styles.person} data-request="">
            <Avatar name={name} src={request.user.avatar_url} size={40} />
            <span className={styles.personText}>
              <Link href={ROUTES.profile(request.user.username)} className={styles.personName}>
                {name}
              </Link>
              <span className={styles.personMeta}>
                @{request.user.username} · {relativeTime(request.created_at)}
              </span>
              {request.message && <p className={styles.requestMessage}>{request.message}</p>}
            </span>
            <span className={styles.personActions}>
              <button type="button" className={cx(ui.button, ui.primary, ui.small)} onClick={() => answer(true)} disabled={review.isPending}>
                Approuver
              </button>
              <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => answer(false)} disabled={review.isPending}>
                Refuser
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AboutCard({ group }: { group: Group }) {
  const PrivacyIcon = group.privacy === "public" ? GlobeIcon : LockIcon;
  return (
    <section className={styles.panelCard} aria-labelledby="groupe-a-propos">
      <h2 id="groupe-a-propos" className={styles.panelTitle}>
        <CommunityIcon aria-hidden="true" />À propos
      </h2>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <PrivacyIcon aria-hidden="true" />
          <dt>{PRIVACY[group.privacy].label}</dt>
          <dd>{PRIVACY[group.privacy].hint}</dd>
        </div>
        <div className={styles.fact}>
          <UserPlusIcon aria-hidden="true" />
          <dt>Adhésion&nbsp;: {JOIN_POLICY[group.join_policy].label.toLowerCase()}</dt>
          <dd>{JOIN_POLICY[group.join_policy].hint}</dd>
        </div>
        {group.created_at && (
          <div className={styles.fact}>
            <CalendarIcon aria-hidden="true" />
            <dt>Créé en {MONTH_YEAR.format(new Date(group.created_at))}</dt>
            <dd>{plural(group.member_count, "membre aujourd'hui", "membres aujourd'hui")}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function GroupPage({ slug }: { slug: string }) {
  const group = useGroup(slug);
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const canApprove = canInGroup(group.data, "member.approve");
  const requests = useJoinRequests(slug, canApprove);

  if (group.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.header}>
          <div className={styles.cover} />
          <div className={styles.identity} style={{ paddingTop: 16 }}>
            <Skeleton width={96} height={96} radius={18} style={{ marginTop: -60 }} />
            <Skeleton width="40%" height={28} />
            <Skeleton width="30%" height={14} />
          </div>
        </div>
      </div>
    );
  }
  if (group.isError) {
    const hidden = group.error instanceof ApiError && group.error.status === 404;
    return (
      <div className={styles.page}>
        <Link href={ROUTES.groups} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Tous les groupes
        </Link>
        {hidden ? (
          <EmptyState icon={<LockIcon />} title="Groupe introuvable" text="Ce groupe n'existe pas, a été archivé, ou il est secret et vous n'en êtes pas membre." />
        ) : (
          <ErrorState error={group.error} onRetry={() => group.refetch()} />
        )}
      </div>
    );
  }

  const data = group.data;
  const tabs = [
    { id: "publications" as const, label: "Publications", Icon: CommentIcon },
    { id: "membres" as const, label: "Membres", Icon: UsersIcon, count: data.member_count },
    ...(canApprove ? [{ id: "demandes" as const, label: "Demandes", Icon: UserCheckIcon, count: requests.data?.length }] : []),
    { id: "a-propos" as const, label: "À propos", Icon: CommunityIcon },
  ];
  const active: Tab = tabs.some((t) => t.id === tab) ? tab : "publications";

  return (
    <div className={styles.page}>
      <GroupHeader group={data} onEdit={() => setEditing(true)} onInvite={() => setInviting(true)} />
      <Tabs idPrefix="groupe" label="Sections du groupe" value={active} onChange={setTab} items={tabs} />
      <TabPanel idPrefix="groupe" id={active}>
        <div className={styles.layout}>
          <div className={styles.column}>
            {active === "publications" && <PostsTab group={data} />}
            {active === "membres" && <MembersTab group={data} />}
            {active === "demandes" && <RequestsTab group={data} />}
            {active === "a-propos" && <AboutCard group={data} />}
          </div>
          {active !== "a-propos" && (
            <aside className={styles.aside} aria-label="À propos du groupe">
              <AboutCard group={data} />
            </aside>
          )}
        </div>
      </TabPanel>
      <EditGroupDialog group={data} open={editing} onClose={() => setEditing(false)} />
      <InviteDialog group={data} open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
