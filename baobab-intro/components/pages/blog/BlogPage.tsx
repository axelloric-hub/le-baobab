import { ArrowRightIcon, BellIcon, PenIcon, UsersIcon, CheckCircleIcon } from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import { NodeCover } from "../shared/NodeCover";
import { PageCta } from "../shared/PageCta";
import { BLOG_CTA, BLOG_FEATURED, BLOG_HERO, BLOG_NOTICE, LAYOUT_EXAMPLE } from "./blog-content";
import { BlogExplorer } from "./BlogGrid";
import styles from "./Blog.module.css";

function Hero() {
  return (
    <>
      <div className={styles.heroHalo} aria-hidden="true" />
      <div className={`${styles.container} ${styles.heroInner}`}>
        <p className={styles.heroBadge}>
          <span aria-hidden="true" />
          {BLOG_HERO.badge}
        </p>
        <h1 id="blog-titre" className={styles.heroTitle}>
          {BLOG_HERO.titleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className={styles.heroSubtitle}>{BLOG_HERO.subtitle}</p>
      </div>
    </>
  );
}

function Featured() {
  return (
    <section className={styles.featuredSection} aria-labelledby="a-la-une-titre">
      <div className={styles.container}>
        <div className={styles.featuredTop}>
          <p className={styles.featuredKicker}>
            <CheckCircleIcon aria-hidden="true" />
            {BLOG_FEATURED.kicker}
          </p>
          <span className={styles.layoutExample}>{LAYOUT_EXAMPLE}</span>
        </div>
        <article className={styles.featured}>
          <div className={styles.featuredCover}>
            <NodeCover variant={0} detailed />
            <span className={styles.draftPill}>
              <span aria-hidden="true" />
              {BLOG_FEATURED.coverLabel}
            </span>
            <span className={styles.coverStamp}>Aperçu illustratif</span>
          </div>
          <div className={styles.featuredBody}>
            <p className={styles.cardMeta}>
              <span className={styles.category}>{BLOG_FEATURED.category}</span>
              <span>{BLOG_FEATURED.meta}</span>
            </p>
            <h2 id="a-la-une-titre" className={styles.featuredTitle}>
              {BLOG_FEATURED.title}
            </h2>
            <p className={styles.featuredExcerpt}>{BLOG_FEATURED.excerpt}</p>
            <div className={styles.featuredFooter}>
              <div className={styles.byline}>
                <span className={styles.bylineAvatar} aria-hidden="true">
                  {BLOG_FEATURED.author.initials}
                </span>
                <span>
                  <strong>{BLOG_FEATURED.author.name}</strong>
                  <span>{BLOG_FEATURED.author.role}</span>
                </span>
              </div>
              {/* Article à paraître : pas encore de page. */}
              <PendingButton className={styles.featuredAction}>
                {BLOG_FEATURED.action}
                <ArrowRightIcon aria-hidden="true" />
              </PendingButton>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function Notice() {
  return (
    <section className={styles.noticeSection} aria-labelledby="coulisses-titre">
      <div className={styles.container}>
        <div className={styles.notice}>
          <div className={styles.noticeRoots} aria-hidden="true" />
          <span className={styles.noticeIcon} aria-hidden="true">
            <PenIcon />
          </span>
          <h2 id="coulisses-titre" className={styles.noticeKicker}>
            {BLOG_NOTICE.kicker}
          </h2>
          <p className={styles.noticeText}>{BLOG_NOTICE.text}</p>
          <div className={styles.noticeActions}>
            {/* Ni notifications e-mail ni inscription raccordées : boutons visuels. */}
            <PendingButton className={styles.noticePrimary}>
              <BellIcon aria-hidden="true" />
              {BLOG_NOTICE.notify}
            </PendingButton>
            <PendingButton className={styles.noticeSecondary}>
              <UsersIcon aria-hidden="true" />
              {BLOG_NOTICE.join}
            </PendingButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BlogPage() {
  return (
    <>
      <BlogExplorer hero={<Hero />} featured={<Featured />} notice={<Notice />} />
      <PageCta id="rejoindre" eyebrow={BLOG_CTA.eyebrow} title={BLOG_CTA.title} text={BLOG_CTA.text} primary={BLOG_CTA.primary} />
    </>
  );
}
