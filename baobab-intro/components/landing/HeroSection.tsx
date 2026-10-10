import type { CSSProperties } from "react";
import { BaobabMark } from "@/components/baobab/BaobabMark";
import { DemoButton } from "./DemoButton";
import { FeatureCards } from "./FeatureCards";
import { ArrowRightIcon, NetworkIcon, PlayIcon } from "./icons";
import { HERO, PENDING_LABEL } from "./landing-content";
import { NetworkBackdrop } from "./NetworkBackdrop";
import styles from "./Hero.module.css";

/** Délai d'apparition (ms) : une seule courte cascade, le contenu reste lisible tout de suite. */
const reveal = (delayMs: number) => ({ "--reveal-delay": `${delayMs}ms` }) as CSSProperties;

/** Devise du projet entre deux filets, puis le public visé (aucun chiffre ni témoignage inventé). */
function Motto() {
  return (
    <div className={`${styles.social} ${styles.reveal}`} style={reveal(300)}>
      <div className={styles.socialRow}>
        <span className={styles.socialRule} aria-hidden="true" />
        <span className={styles.motto}>{HERO.motto}</span>
        <span className={styles.socialRule} aria-hidden="true" />
      </div>
      <p className={styles.socialText}>{HERO.audience}</p>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <NetworkBackdrop />

      <div className={styles.grid}>
        <div className={styles.copy}>
          <p className={`${styles.badge} ${styles.reveal}`} style={reveal(0)}>
            <NetworkIcon className={styles.badgeIcon} />
            <span>{HERO.badge}</span>
          </p>

          <h1 id="hero-title" className={`${styles.title} ${styles.reveal}`} style={reveal(60)}>
            {HERO.titleLines.map((line, lineIndex) => (
              <span key={lineIndex} className={styles.titleLine}>
                {line.map((phrase, phraseIndex) => (
                  <span key={phrase}>
                    {phraseIndex > 0 && " "}
                    <span className={styles.titlePhrase}>{phrase}</span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p className={`${styles.lead} ${styles.reveal}`} style={reveal(120)}>
            {HERO.lead}
          </p>

          <div className={`${styles.ctas} ${styles.reveal}`} style={reveal(240)}>
            {/* Aucun parcours d'inscription n'existe encore : bouton visuel, sans action. */}
            <button
              type="button"
              className={styles.primaryButton}
              aria-disabled="true"
              title={PENDING_LABEL}
              data-pending="inscription"
            >
              {HERO.primaryCta}
              <ArrowRightIcon className={styles.buttonArrow} />
            </button>
            <DemoButton className={styles.secondaryButton}>
              <PlayIcon className={styles.buttonPlay} />
              {HERO.secondaryCta}
            </DemoButton>
          </div>

          <Motto />
        </div>

        <div className={`${styles.visual} ${styles.revealMark}`} style={reveal(100)}>
          <div className={styles.markHalo} aria-hidden="true" />
          <BaobabMark className={styles.mark} glow title="Logo LE BAOBAB" />
        </div>

        <FeatureCards />
      </div>
    </section>
  );
}
