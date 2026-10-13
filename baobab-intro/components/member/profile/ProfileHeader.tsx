"use client";

import { useState } from "react";
import { useRelationAction } from "@/features/people/mutations";
import { AVAILABILITY_LABELS, PROVIDER_LABELS } from "@/features/people/reference";
import type { Profile } from "@/features/people/types";
import { describeError } from "@/lib/api/errors";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { useOpenConversation } from "../messages/NewConversationDialog";
import { ConfirmDialog } from "../post/PostDialogs";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import {
  BlockIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  ExternalIcon,
  MapPinIcon,
  MessageIcon,
  MoreIcon,
  MuteIcon,
  PenIcon,
  ShareIcon,
  StarUserIcon,
  UserCheckIcon,
  UserMinusIcon,
  UserPlusIcon,
  VerifiedIcon,
} from "../ui/icons";
import { Menu, type MenuEntry } from "../ui/Menu";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import styles from "./Profile.module.css";

const MONTH_YEAR = new Intl.DateTimeFormat("fr", { month: "long", year: "numeric" });

function RelationActions({ profile }: { profile: Profile }) {
  const toast = useToast();
  const act = useRelationAction(profile);
  const openConversation = useOpenConversation();
  const [confirm, setConfirm] = useState<null | "block" | "unfriend">(null);
  const [opening, setOpening] = useState(false);
  const r = profile.relation!;
  const name = profile.display_name || profile.username;
  const first = name.split(" ")[0];

  const run = (action: Parameters<typeof act.mutate>[0], success?: string) =>
    act.mutate(action, {
      onSuccess: () => success && toast(success, { tone: "success" }),
      onError: (error) => toast(describeError(error), { tone: "error" }),
    });

  const copyLink = () =>
    navigator.clipboard.writeText(`${window.location.origin}${ROUTES.profile(profile.username)}`).then(
      () => toast("Lien du profil copié.", { tone: "success" }),
      () => toast("Impossible de copier sur cet appareil.", { tone: "error" }),
    );

  const more: MenuEntry[] = [
    { label: "Copier le lien du profil", icon: <CopyIcon />, onSelect: copyLink },
    { label: "Mettre en sourdine", icon: <MuteIcon />, onSelect: () => run("mute", `Les contenus de ${first} n'apparaîtront plus dans votre fil.`) },
    { kind: "separator" },
    { label: `Bloquer ${first}`, icon: <BlockIcon />, tone: "danger", onSelect: () => setConfirm("block") },
  ];

  let friendButton;
  if (r.is_friend) {
    friendButton = (
      <Menu
        label={`Vous êtes ami avec ${first}`}
        triggerClassName={cx(ui.button, ui.secondary)}
        align="right"
        trigger={
          <>
            <UserCheckIcon />
            Amis
            <ChevronDownIcon width={16} height={16} />
          </>
        }
        items={[
          r.is_close_friend
            ? { label: "Retirer des amis proches", icon: <StarUserIcon />, onSelect: () => run("close-off", "Retiré de vos amis proches.") }
            : { label: "Ajouter aux amis proches", icon: <StarUserIcon />, onSelect: () => run("close-on", "Ajouté à vos amis proches.") },
          { kind: "separator" },
          { label: "Retirer des amis", icon: <UserMinusIcon />, tone: "danger", onSelect: () => setConfirm("unfriend") },
        ]}
      />
    );
  } else if (r.friend_request?.direction === "received") {
    friendButton = (
      <>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={() => run("accept", `Vous êtes maintenant ami avec ${first}.`)} disabled={act.isPending}>
          <CheckIcon />
          Accepter la demande
        </button>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => run("decline", "Demande refusée.")} disabled={act.isPending}>
          Refuser
        </button>
      </>
    );
  } else if (r.friend_request?.direction === "sent") {
    friendButton = (
      <Menu
        label="Demande d'ami envoyée"
        triggerClassName={cx(ui.button, ui.secondary)}
        align="right"
        trigger={
          <>
            <ClockIcon />
            Demande envoyée
          </>
        }
        items={[{ label: "Annuler la demande", icon: <UserMinusIcon />, onSelect: () => run("cancel-request", "Demande annulée.") }]}
      />
    );
  } else {
    friendButton = (
      <button type="button" className={cx(ui.button, ui.primary)} onClick={() => run("friend-request", "Demande d'ami envoyée.")} disabled={act.isPending}>
        <UserPlusIcon />
        Ajouter en ami
      </button>
    );
  }

  return (
    <>
      {friendButton}
      <button
        type="button"
        className={cx(ui.button, ui.secondary)}
        aria-pressed={r.is_following}
        onClick={() => run(r.is_following ? "unfollow" : "follow")}
        disabled={act.isPending}
      >
        {r.is_following ? "Abonné" : "Suivre"}
      </button>
      <button
        type="button"
        className={cx(ui.button, ui.secondary)}
        disabled={opening}
        onClick={async () => {
          setOpening(true);
          try {
            await openConversation(profile.username);
          } catch (error) {
            toast(describeError(error), { tone: "error" });
            setOpening(false);
          }
        }}
      >
        <MessageIcon />
        Message
      </button>
      <Menu label="Plus d'actions" items={more} trigger={<MoreIcon />} />
      {confirm && (
        <ConfirmDialog
          open
          busy={act.isPending}
          onClose={() => setConfirm(null)}
          title={confirm === "block" ? `Bloquer ${name} ?` : `Retirer ${name} de vos amis ?`}
          text={
            confirm === "block"
              ? "Vous ne verrez plus ses contenus et il ou elle ne pourra plus vous voir ni vous écrire. L'amitié et les abonnements sont retirés dans les deux sens."
              : "Vous ne serez plus amis. Vous pourrez renvoyer une demande plus tard."
          }
          confirm={confirm === "block" ? "Bloquer" : "Retirer"}
          onConfirm={() =>
            act.mutate(confirm, {
              onSuccess: () => {
                setConfirm(null);
                toast(confirm === "block" ? `${name} est bloqué(e).` : "Ami retiré.", { tone: "success" });
                if (confirm === "block") window.location.assign(ROUTES.feed);
              },
              onError: (error) => toast(describeError(error), { tone: "error" }),
            })
          }
        />
      )}
    </>
  );
}

export function ProfileHeader({ profile, isMe, onEdit }: { profile: Profile; isMe: boolean; onEdit: () => void }) {
  const toast = useToast();
  const name = profile.display_name || profile.username;
  const place = [profile.city, profile.country?.name].filter(Boolean).join(", ");
  const availability = AVAILABILITY_LABELS[profile.availability];
  const relation = profile.relation;

  return (
    <header className={styles.header}>
      <div className={styles.cover}>
        {profile.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img src={profile.cover_url} alt="" />
        )}
      </div>
      <div className={styles.identity}>
        <div className={styles.avatarRow}>
          <span className={styles.avatarRing}>
            <Avatar name={name} src={profile.avatar_url} size={96} />
          </span>
          <div className={styles.actions}>
            {isMe ? (
              <>
                <button type="button" className={cx(ui.button, ui.primary)} onClick={onEdit}>
                  <PenIcon />
                  Modifier le profil
                </button>
                <button
                  type="button"
                  className={cx(ui.button, ui.secondary)}
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}${ROUTES.profile(profile.username)}`).then(
                      () => toast("Lien de votre profil copié.", { tone: "success" }),
                      () => toast("Impossible de copier sur cet appareil.", { tone: "error" }),
                    )
                  }
                >
                  <ShareIcon />
                  Partager
                </button>
              </>
            ) : (
              relation && <RelationActions profile={profile} />
            )}
          </div>
        </div>

        <div>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{name}</h1>
            {profile.is_verified && (
              <span className={styles.verified} title="Profil vérifié">
                <VerifiedIcon aria-hidden="true" />
                <span className="bb-visually-hidden">Profil vérifié</span>
              </span>
            )}
            <span className={styles.handle}>@{profile.username}</span>
            {availability && <span className={styles.availability}>{availability}</span>}
          </div>
          {profile.headline && <p className={styles.headline}>{profile.headline}</p>}
          <ul className={styles.meta}>
            {place && (
              <li>
                <MapPinIcon aria-hidden="true" />
                {place}
              </li>
            )}
            {profile.profession && (
              <li>
                <BriefcaseIcon aria-hidden="true" />
                {profile.profession.name}
              </li>
            )}
            {profile.joined_at && (
              <li>
                <CalendarIcon aria-hidden="true" />
                Membre depuis {MONTH_YEAR.format(new Date(profile.joined_at))}
              </li>
            )}
          </ul>
          {profile.links.length > 0 && (
            <ul className={styles.links}>
              {profile.links.map((link) => (
                <li key={link.id}>
                  <a className={styles.link} href={link.url} target="_blank" rel="noopener noreferrer me">
                    <ExternalIcon aria-hidden="true" />
                    {PROVIDER_LABELS[link.provider] ?? link.provider}
                    {link.handle && ` · ${link.handle}`}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {profile.stats && (
            <ul className={styles.stats} aria-label="Statistiques">
              <li>
                <strong>{profile.stats.posts}</strong>
                {plural(profile.stats.posts, "publication", "publications").replace(/^\S+\s/, "")}
              </li>
              <li>
                <strong>{profile.stats.followers}</strong>
                {plural(profile.stats.followers, "abonné", "abonnés").replace(/^\S+\s/, "")}
              </li>
              <li>
                <strong>{profile.stats.following}</strong>
                {plural(profile.stats.following, "abonnement", "abonnements").replace(/^\S+\s/, "")}
              </li>
              <li>
                <strong>{profile.stats.friends}</strong>
                {plural(profile.stats.friends, "ami", "amis").replace(/^\S+\s/, "")}
              </li>
            </ul>
          )}
          {relation?.follows_me && !relation.is_friend && <p className={styles.relationNote}>Vous suit</p>}
        </div>
      </div>
    </header>
  );
}
