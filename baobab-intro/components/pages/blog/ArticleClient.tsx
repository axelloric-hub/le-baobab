"use client";

import { useEffect, useState } from "react";
import { MailIcon } from "@/components/landing/icons";
import styles from "./Article.module.css";

/** Barre de progression de lecture (en haut de l'écran, sous la navigation). */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const total = rect.height - window.innerHeight * 0.6;
        const read = Math.min(Math.max(-rect.top + window.innerHeight * 0.2, 0), Math.max(total, 1));
        setProgress(total > 0 ? read / total : 1);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [targetId]);

  return (
    <div className={styles.progress} aria-hidden="true">
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/** Sommaire : met en évidence la partie en cours de lecture. */
export function ArticleToc({ title, items }: { title: string; items: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={styles.toc} aria-label={title}>
      <p className={styles.tocTitle}>{title}</p>
      <ol className={styles.tocList}>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className={styles.tocLink} aria-current={active === item.id ? "location" : undefined}>
              <span aria-hidden="true" className={styles.tocDot} />
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Partage : vraies adresses de partage, construites avec l'URL de la page une fois affichée. */
export function ShareLinks({ title, label }: { title: string; label: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href.split("#")[0]), []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const links = [
    { name: "X", text: "𝕏", href: `https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}` },
    { name: "LinkedIn", text: "in", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  ];

  return (
    <div className={styles.share}>
      <span className={styles.shareLabel}>{label}</span>
      {links.map((link) => (
        <a
          key={link.name}
          className={styles.shareButton}
          href={url ? link.href : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Partager sur ${link.name} (nouvel onglet)`}
          aria-disabled={url ? undefined : "true"}
        >
          <span aria-hidden="true">{link.text}</span>
        </a>
      ))}
      <a
        className={styles.shareButton}
        href={url ? `mailto:?subject=${encodedTitle}&body=${encodedUrl}` : undefined}
        aria-label="Partager par e-mail"
        aria-disabled={url ? undefined : "true"}
      >
        <MailIcon aria-hidden="true" />
      </a>
    </div>
  );
}
