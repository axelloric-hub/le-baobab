"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { socialApi } from "@/features/social/api";
import type { Ad } from "@/features/social/types";
import { safeUrl } from "@/features/social/payload";
import postStyles from "../post/Post.module.css";
import { cx } from "../ui/cx";
import { ExternalIcon, SparklesIcon } from "../ui/icons";
import ui from "../ui/ui.module.css";

/** Impressions déjà rapportées (une par impression_id, comme l'exige le serveur). */
const reported = new Set<string>();

function AdCard({ ad, placement }: { ad: Ad; placement: "feed" | "sidebar" }) {
  const ref = useRef<HTMLElement>(null);
  const destination = safeUrl(ad.destination_url);

  // Impression comptée si l'annonce est visible à 50 % pendant 1 s (norme MRC/IAB).
  useEffect(() => {
    const node = ref.current;
    if (!node || reported.has(ad.impression_id) || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (entry.isIntersecting)
          timer = window.setTimeout(() => {
            reported.add(ad.impression_id);
            observer.disconnect();
            socialApi.adImpression(ad.id, placement, ad.impression_id).catch(() => reported.delete(ad.impression_id));
          }, 1000);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ad, placement]);

  if (!destination) return null;

  return (
    <aside ref={ref} className={cx(postStyles.card, postStyles.ad)} aria-label="Contenu sponsorisé">
      <p className={postStyles.adLabel}>
        <SparklesIcon width={14} height={14} aria-hidden="true" />
        Sponsorisé
      </p>
      {ad.media_url && (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée
        <img className={postStyles.adMedia} src={ad.media_url} alt="" loading="lazy" />
      )}
      <p className={postStyles.adHeadline}>{ad.headline}</p>
      {ad.body && <p className={postStyles.adBody}>{ad.body}</p>}
      <a
        href={destination}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={cx(ui.button, ui.secondary, placement === "sidebar" && ui.block)}
        onClick={() => {
          // Le clic est rapporté sans retarder l'ouverture du lien.
          socialApi.adClick(ad.impression_id).catch(() => {});
        }}
      >
        {ad.cta_label || "En savoir plus"}
        <ExternalIcon aria-hidden="true" />
      </a>
    </aside>
  );
}

/** Emplacement publicitaire : n'affiche rien s'il n'y a aucune annonce à diffuser. */
export function AdSlot({ placement }: { placement: "feed" | "sidebar" }) {
  const ads = useQuery({ queryKey: ["ads", placement], queryFn: () => socialApi.ads(placement, 1), staleTime: 10 * 60_000, retry: false });
  const ad = ads.data?.[0];
  return ad ? <AdCard ad={ad} placement={placement} /> : null;
}
