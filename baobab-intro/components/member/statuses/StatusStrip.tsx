"use client";

import { useEffect, useRef, useState } from "react";
import { useMe } from "@/features/me/me";
import { useStatuses } from "@/features/social/hooks";
import { currentUser } from "@/lib/auth/session";
import { useCreation } from "../shell/creation-context";
import { Avatar } from "../ui/Avatar";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../ui/icons";
import { Skeleton } from "../ui/States";
import styles from "./Status.module.css";
import { groupStatuses, type StatusGroup } from "./status-utils";
import { StatusViewer } from "./StatusViewer";

/** Bandeau des statuts (24 h) en haut du fil — motif WhatsApp / Instagram. */
export function StatusStrip() {
  const statuses = useStatuses();
  const me = useMe();
  const { openStatus } = useCreation();
  const username = me.data?.username ?? currentUser()?.username ?? "";
  const myName = me.data?.display_name || username;
  const { mine, others } = groupStatuses(statuses.data ?? [], username);
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  // Instantané des groupes à l'ouverture : l'ordre ne bouge pas pendant la lecture.
  const [viewer, setViewer] = useState<{ groups: StatusGroup[]; index: number } | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => setEdges({ left: track.scrollLeft > 4, right: track.scrollLeft + track.clientWidth < track.scrollWidth - 4 });
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [statuses.data]);

  const scrollBy = (direction: 1 | -1) => trackRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  const first = (name: string) => name.split(/\s+/)[0];

  return (
    <section className={styles.strip} aria-label="Statuts">
      <button type="button" className={`${styles.scroll} ${styles.scrollLeft}`} data-visible={edges.left || undefined} onClick={() => scrollBy(-1)} aria-label="Statuts précédents" tabIndex={-1}>
        <ChevronLeftIcon />
      </button>
      <ul ref={trackRef} className={styles.track}>
        <li className={styles.tile}>
          {mine ? (
            <button type="button" className={styles.tileButton} onClick={() => setViewer({ groups: [mine], index: 0 })} aria-label="Voir mes statuts">
              <Avatar name={myName || "?"} src={me.data?.avatar_url} size={56} ring="seen" />
              <span className={styles.tileName}>Mon statut</span>
            </button>
          ) : (
            <button type="button" className={styles.tileButton} onClick={openStatus} aria-label="Créer un statut">
              <span className={styles.myAvatar}>
                <Avatar name={myName || "?"} src={me.data?.avatar_url} size={56} />
              </span>
              <span className={styles.tileName}>Mon statut</span>
            </button>
          )}
          <button type="button" className={styles.add} onClick={openStatus} aria-label="Ajouter un statut" tabIndex={mine ? 0 : -1}>
            <PlusIcon />
          </button>
        </li>
        {statuses.isPending &&
          [0, 1, 2, 3].map((i) => (
            <li key={i} className={styles.tile} aria-hidden="true">
              <span className={styles.tileButton}>
                <Skeleton width={65} height={65} radius="50%" />
                <Skeleton width={48} height={10} />
              </span>
            </li>
          ))}
        {others.map((group, index) => {
          const name = group.author.display_name || group.author.username;
          return (
            <li key={group.author.username} className={styles.tile}>
              <button
                type="button"
                className={styles.tileButton}
                data-seen={!group.unseen || undefined}
                onClick={() => setViewer({ groups: others, index })}
                aria-label={`Statuts de ${name}${group.unseen ? " (nouveau)" : ""}`}
              >
                <Avatar name={name} src={group.author.avatar_url} size={56} ring={group.unseen ? "unseen" : "seen"} />
                <span className={styles.tileName}>{first(name)}</span>
              </button>
            </li>
          );
        })}
        {!statuses.isPending && others.length === 0 && (
          <li className={styles.stripEmpty}>Les statuts de vos amis et des personnes que vous suivez apparaîtront ici pendant 24&nbsp;heures.</li>
        )}
      </ul>
      <button type="button" className={`${styles.scroll} ${styles.scrollRight}`} data-visible={edges.right || undefined} onClick={() => scrollBy(1)} aria-label="Statuts suivants" tabIndex={-1}>
        <ChevronRightIcon />
      </button>
      {viewer && <StatusViewer groups={viewer.groups} startGroup={viewer.index} me={username} onClose={() => setViewer(null)} />}
    </section>
  );
}
