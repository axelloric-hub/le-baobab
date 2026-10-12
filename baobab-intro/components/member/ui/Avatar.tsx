"use client";

import { useState } from "react";
import { initials } from "@/lib/format";
import styles from "./ui.module.css";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 24 | 28 | 32 | 36 | 40 | 44 | 48 | 56 | 64 | 96;
  /** Anneau des statuts : « unseen » (dégradé de la charte), « seen » (neutre). */
  ring?: "unseen" | "seen";
  className?: string;
}

/** Couleur de repli stable dérivée du nom (palette de la charte uniquement). */
const TONES = ["#6f2c0e", "#8a3a12", "#5a2410", "#1f56d6", "#9a4a1f", "#2563eb"];
function tone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

/** Avatar décoratif : le nom est toujours écrit à côté, donc aria-hidden. */
export function Avatar({ name, src, size = 40, ring, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const avatar = (
    <span
      className={`${styles.avatar} ${ring ? "" : (className ?? "")}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)), ["--tone" as string]: tone(name) }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée de courte durée : pas d'optimisation d'image
        <img src={src!} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
  if (!ring) return avatar;
  return (
    <span className={`${styles.ring} ${className ?? ""}`} data-ring={ring} aria-hidden="true">
      {avatar}
    </span>
  );
}
