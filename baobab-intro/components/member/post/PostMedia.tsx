"use client";

import { useEffect, useRef, useState } from "react";
import type { PostMedia as Media } from "@/features/social/types";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, FileIcon } from "../ui/icons";
import styles from "./Post.module.css";

function prefersCalm() {
  if (typeof window === "undefined") return true;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return Boolean(saveData) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Vidéo : lecture automatique sans le son quand elle est visible (sauf économie de données / mouvement réduit). */
function AutoVideo({ media }: { media: Media }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || prefersCalm() || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className={styles.video}
      src={media.url}
      muted
      playsInline
      loop
      controls
      preload="metadata"
      aria-label={media.alt || "Vidéo de la publication"}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
    />
  );
}

function Lightbox({ images, index, onClose, onIndex }: { images: Media[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const go = (delta: number) => onIndex((index + delta + images.length) % images.length);
  const image = images[index];
  return (
    <dialog
      ref={ref}
      className={styles.lightbox}
      aria-label={`Image ${index + 1} sur ${images.length}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (images.length > 1 && e.key === "ArrowRight") go(1);
        if (images.length > 1 && e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className={styles.lightboxInner} onClick={(e) => e.target === e.currentTarget && onClose()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée */}
        <img key={image.url} src={image.url} alt={image.alt || ""} />
        {image.alt && <p className={styles.lightboxCaption}>{image.alt}</p>}
      </div>
      <button type="button" className={`${styles.lightboxButton} ${styles.lightboxClose}`} onClick={onClose} aria-label="Fermer" autoFocus>
        <CloseIcon />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className={`${styles.lightboxButton} ${styles.lightboxPrev}`} onClick={() => go(-1)} aria-label="Image précédente">
            <ChevronLeftIcon />
          </button>
          <button type="button" className={`${styles.lightboxButton} ${styles.lightboxNext}`} onClick={() => go(1)} aria-label="Image suivante">
            <ChevronRightIcon />
          </button>
        </>
      )}
    </dialog>
  );
}

/**
 * Médias d'une publication : grille de 1 à 4 images (« +N » au-delà), vidéo, audio ou fichier.
 * Double appui sur une image : « J'aime » (onDoubleTap), appui simple : agrandissement.
 */
export function PostMedia({ media, onDoubleTap }: { media: Media[]; onDoubleTap?: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const single = useRef<number | undefined>(undefined);

  if (media.length === 0) return null;
  const images = media.filter((m) => m.kind === "image");
  const others = media.filter((m) => m.kind !== "image");

  const tap = (index: number) => {
    const now = Date.now();
    if (onDoubleTap && now - lastTap.current < 280) {
      window.clearTimeout(single.current);
      lastTap.current = 0;
      setBurst((n) => n + 1);
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    single.current = window.setTimeout(() => setOpen(index), onDoubleTap ? 280 : 0);
  };

  const shown = images.slice(0, 4);
  return (
    <>
      {shown.length > 0 && (
        <div className={styles.media} data-count={shown.length} style={{ position: "relative" }}>
          {shown.map((image, index) => (
            <button
              key={image.url}
              type="button"
              className={styles.mediaItem}
              onClick={() => tap(index)}
              aria-label={`Agrandir l'image ${index + 1}${image.alt ? ` : ${image.alt}` : ""}`}
              style={shown.length === 1 && image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée */}
              <img src={image.url} alt={image.alt || ""} loading="lazy" decoding="async" width={image.width ?? undefined} height={image.height ?? undefined} />
              {index === 3 && images.length > 4 && <span className={styles.mediaMore}>+{images.length - 4}</span>}
            </button>
          ))}
          {burst > 0 && (
            <span key={burst} className={styles.burst} aria-hidden="true">
              👍
            </span>
          )}
        </div>
      )}
      {others.map((item) =>
        item.kind === "video" ? (
          <div key={item.url} className={styles.media} data-count="1">
            <AutoVideo media={item} />
          </div>
        ) : item.kind === "audio" ? (
          <audio key={item.url} className={styles.audio} src={item.url} controls preload="none" aria-label={item.alt || "Audio de la publication"} />
        ) : (
          <a key={item.url} href={item.url} className={styles.file} target="_blank" rel="noopener noreferrer">
            <FileIcon />
            {item.alt || "Ouvrir le fichier joint"}
          </a>
        ),
      )}
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}
