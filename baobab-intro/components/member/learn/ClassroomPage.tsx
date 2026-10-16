"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useClassroom, useClassroomMembers, useClassroomMembership } from "@/features/learn/hooks";
import { useRespondInvitation } from "@/features/sidebar/hooks";
import type { ClassroomDetail } from "@/features/learn/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { BuyAccess } from "../shop/BuyAccess";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { EntityHeader, EntityHeaderSkeleton } from "../ui/EntityHeader";
import { ArrowLeftIcon, CheckIcon, ClockIcon, GlobeIcon, LearnIcon, LockIcon, LogoutIcon, MoreIcon, PlusIcon, UserCheckIcon, UserPlusIcon, UsersIcon } from "../ui/icons";
import { Menu } from "../ui/Menu";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { CreateCourseDialog, InviteToClassroomDialog } from "./ClassroomDialogs";
import { CourseCard } from "./CourseCard";
import { CLASSROOM_PRIVACY, ROLE_LABELS } from "./labels";

const TAB_IDS = ["cours", "membres", "demandes"] as const;

function JoinAction({ classroom }: { classroom: ClassroomDetail }) {
  const toast = useToast();
  const { join } = useClassroomMembership(classroom.slug);
  const respond = useRespondInvitation("classrooms");
  const client = useQueryClient();
  if (classroom.my_status === "active") return null;
  if (classroom.my_invitation) {
    const answer = (accept: boolean) =>
      respond.mutate(
        { id: classroom.my_invitation!.id, accept },
        {
          onSuccess: () => {
            toast(accept ? `Bienvenue dans « ${classroom.title} ».` : "Invitation déclinée.", { tone: "success" });
            void client.invalidateQueries({ queryKey: ["classroom", classroom.slug] });
            void client.invalidateQueries({ queryKey: ["classrooms"] });
          },
          onError: (e) => toast(describeError(e), { tone: "error" }),
        },
      );
    return (
      <>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={() => answer(true)} disabled={respond.isPending}>
          <CheckIcon />
          Accepter l&apos;invitation
        </button>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => answer(false)} disabled={respond.isPending}>
          Décliner
        </button>
      </>
    );
  }
  if (classroom.my_status === "pending") {
    return (
      <span className={cx(ui.button, ui.ghost)} aria-disabled="true">
        <ClockIcon />
        Demande envoyée
      </span>
    );
  }
  if (classroom.privacy === "invite_only") {
    return (
      <span className={cx(ui.button, ui.ghost)} aria-disabled="true">
        <LockIcon />
        Sur invitation
      </span>
    );
  }
  if (classroom.is_paid) {
    return (
      <>
        <span className={cx(ui.button, ui.ghost)} aria-disabled="true" title="L'accès à cette classe s'achète dans la Boutique">
          <LockIcon />
          Classe payante
        </span>
        <BuyAccess target={classroom.id} primary block={false} />
      </>
    );
  }
  return (
    <button
      type="button"
      className={cx(ui.button, ui.primary)}
      disabled={join.isPending}
      onClick={() =>
        join.mutate(undefined, {
          onSuccess: (r) => toast(r.status === "active" ? `Bienvenue dans « ${classroom.title} ».` : "Demande envoyée aux enseignants.", { tone: "success" }),
          onError: (e) => toast(describeError(e), { tone: "error" }),
        })
      }
    >
      <PlusIcon />
      {classroom.privacy === "public" ? "Rejoindre la classe" : "Demander à rejoindre"}
    </button>
  );
}

function Members({ classroom, status }: { classroom: ClassroomDetail; status: "active" | "pending" }) {
  const toast = useToast();
  const members = useClassroomMembers(classroom.slug, status, true);
  const { review } = useClassroomMembership(classroom.slug);
  if (members.isPending) return <Skeleton height={140} radius={18} />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => members.refetch()} />;
  if (members.data.length === 0) {
    return status === "pending" ? (
      <EmptyState icon={<UserCheckIcon />} title="Aucune demande en attente" />
    ) : (
      <EmptyState icon={<UsersIcon />} title="Aucun membre" />
    );
  }
  return (
    <ul className={layout.people} aria-label={status === "pending" ? "Demandes d'adhésion" : "Membres"}>
      {members.data.map((m) => (
        <li key={m.id} className={layout.person} data-request={status === "pending" ? "" : undefined}>
          <Avatar name={m.display_name || m.username} src={m.avatar_url} size={40} />
          <span className={layout.personText}>
            <Link href={ROUTES.profile(m.username)} className={layout.personName}>
              {m.display_name || m.username}
            </Link>
            <span className={layout.personMeta}>@{m.username}</span>
          </span>
          <span className={layout.personActions}>
            {status === "pending" ? (
              <>
                <button
                  type="button"
                  className={cx(ui.button, ui.primary, ui.small)}
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: m.id, approve: true }, { onSuccess: () => toast("Membre accepté.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) })}
                >
                  <CheckIcon />
                  Accepter
                </button>
                <button
                  type="button"
                  className={cx(ui.button, ui.secondary, ui.small)}
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: m.id, approve: false }, { onSuccess: () => toast("Demande refusée.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) })}
                >
                  Refuser
                </button>
              </>
            ) : (
              <Pill tone={m.role === "student" ? "neutral" : "brown"}>{ROLE_LABELS[m.role] ?? m.role}</Pill>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ClassroomPage({ slug }: { slug: string }) {
  const query = useClassroom(slug);
  const toast = useToast();
  const { leave } = useClassroomMembership(slug);
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pending = useClassroomMembers(slug, "pending", Boolean(query.data?.is_staff));

  if (query.isPending) return <EntityHeaderSkeleton />;
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={`${ROUTES.learn}?onglet=classes`} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Classes
        </Link>
        {gone ? <EmptyState icon={<LockIcon />} title="Classe introuvable" text="Cette classe n'existe pas, ou elle est privée et vous n'en êtes pas membre." /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }
  const c = query.data;
  const staff = c.is_staff;
  const PrivacyIcon = c.privacy === "public" ? GlobeIcon : LockIcon;
  const tabs = [
    { id: "cours" as const, label: "Cours", Icon: LearnIcon, count: c.courses.length },
    ...(staff ? [{ id: "membres" as const, label: "Membres", Icon: UsersIcon, count: c.member_count }] : []),
    ...(staff && c.privacy !== "public" ? [{ id: "demandes" as const, label: "Demandes", Icon: UserCheckIcon, count: pending.data?.length }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "cours";
  const canLeave = c.my_status === "active" && c.my_role !== "owner";

  return (
    <div className={layout.page}>
      <EntityHeader
        name={c.title}
        description={c.description || undefined}
        actions={
          <>
            {staff && (
              <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setCreating(true)}>
                <PlusIcon />
                Créer un cours
              </button>
            )}
            {staff && (
              <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setInviting(true)}>
                <UserPlusIcon />
                Inviter
              </button>
            )}
            <JoinAction classroom={c} />
            {canLeave && <Menu label="Actions de la classe" items={[{ label: "Quitter la classe", icon: <LogoutIcon />, tone: "danger", onSelect: () => setLeaving(true) }]} trigger={<MoreIcon />} />}
          </>
        }
        meta={
          <>
            <li>
              <PrivacyIcon aria-hidden="true" />
              {CLASSROOM_PRIVACY[c.privacy].label}
            </li>
            <li>
              <UsersIcon aria-hidden="true" />
              {plural(c.member_count, "membre", "membres")}
            </li>
            <li>
              <Avatar name={c.owner.display_name || c.owner.username} src={c.owner.avatar_url} size={24} />
              <Link href={ROUTES.profile(c.owner.username)} style={{ color: "inherit" }}>
                {c.owner.display_name || c.owner.username}
              </Link>
            </li>
            {c.is_paid && c.price_minor && <li>Accès : {formatMoney(c.price_minor, c.currency)}</li>}
            {c.my_role && <li>Vous êtes {(ROLE_LABELS[c.my_role] ?? c.my_role).toLowerCase()}</li>}
          </>
        }
      />
      {tabs.length > 1 && <Tabs idPrefix="classe" label="Sections de la classe" value={active} onChange={setTab} items={tabs} />}
      <TabPanel idPrefix="classe" id={active} className={layout.stack}>
        {active === "cours" &&
          (c.courses.length === 0 ? (
            <EmptyState
              icon={<LearnIcon />}
              title="Aucun cours pour l'instant"
              text={staff ? "Créez le premier cours de la classe : modules, chapitres, vidéos, quiz et devoirs." : "Les cours publiés de la classe apparaîtront ici."}
              actions={
                staff && (
                  <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setCreating(true)}>
                    <PlusIcon />
                    Créer un cours
                  </button>
                )
              }
            />
          ) : (
            <div className={layout.grid}>
              {c.courses.map((course) => (
                <CourseCard key={course.id} course={course} showStatus={staff} />
              ))}
            </div>
          ))}
        {active === "membres" && <Members classroom={c} status="active" />}
        {active === "demandes" && <Members classroom={c} status="pending" />}
      </TabPanel>
      {staff && <CreateCourseDialog classroom={c.slug} open={creating} onClose={() => setCreating(false)} />}
      {staff && <InviteToClassroomDialog classroom={c.slug} open={inviting} onClose={() => setInviting(false)} />}
      <ConfirmDialog
        open={leaving}
        busy={leave.isPending}
        onClose={() => setLeaving(false)}
        title={`Quitter « ${c.title} » ?`}
        text="Vous ne verrez plus les cours réservés aux membres. Votre progression est conservée si vous revenez."
        confirm="Quitter"
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => {
              setLeaving(false);
              toast("Vous avez quitté la classe.", { tone: "success" });
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          })
        }
      />
    </div>
  );
}
