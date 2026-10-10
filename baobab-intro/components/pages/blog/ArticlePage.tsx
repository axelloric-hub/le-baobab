import Link from "next/link";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ClockIcon,
  CommentIcon,
  ForumIcon,
  HeartIcon,
  ShieldIcon,
  SparklesIcon,
  TerminalIcon,
} from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import sections from "@/components/landing/sections/Sections.module.css";
import { CodeBlock } from "../shared/CodeBlock";
import { CopyButton } from "../shared/CopyButton";
import { NodeCover } from "../shared/NodeCover";
import shared from "../shared/Pages.module.css";
import { RichText } from "../shared/RichText";
import { ArticleToc, ReadingProgress, ShareLinks } from "./ArticleClient";
import { ARTICLE_IDEMPOTENCE, type ArticleBlock } from "./article-idempotence";
import { BLOG_POSTS, LAYOUT_EXAMPLE } from "./blog-content";
import styles from "./Article.module.css";

const ARTICLE = ARTICLE_IDEMPOTENCE;
const BODY_ID = "contenu-article";

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className={styles.paragraph}>
          <RichText text={block.text} />
        </p>
      );
    case "quote":
      return (
        <figure className={styles.quote}>
          <blockquote>
            <p>«&nbsp;{block.text}&nbsp;»</p>
          </blockquote>
          <figcaption>— {block.cite}</figcaption>
        </figure>
      );
    case "code":
      return (
        <div className={styles.codeWrap}>
          <CodeBlock code={block.code} filename={block.filename} language={block.language} copyable />
          <p className={styles.codeCaption}>
            <span>{block.caption}</span>
            <span className={styles.codeStamp}>Aperçu illustratif</span>
          </p>
        </div>
      );
    case "formula":
      return (
        <p className={styles.formula}>
          <code>{block.text}</code>
        </p>
      );
    case "note":
      return (
        <aside className={styles.note}>
          <ShieldIcon aria-hidden="true" />
          <div>
            <p className={styles.noteTitle}>{block.title}</p>
            <p className={styles.noteText}>
              <RichText text={block.text} />
            </p>
          </div>
        </aside>
      );
    case "checklist":
      return (
        <ul className={styles.checklist}>
          {block.items.map((item) => (
            <li key={item.title}>
              <CheckCircleIcon aria-hidden="true" />
              <span>
                <strong>{item.title}&nbsp;:</strong> {item.text}
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

export function ArticlePage() {
  const related = BLOG_POSTS.filter((post) => !post.slug).slice(1, 3);
  const toc = ARTICLE.sections.map((section) => ({ id: section.id, label: section.short }));

  return (
    <>
      <ReadingProgress targetId={BODY_ID} />

      {/* En-tête de l'article */}
      <section className={styles.header} aria-labelledby="article-titre">
        <div className={styles.headerInner}>
          <nav className={shared.breadcrumb} aria-label="Fil d'Ariane">
            <ol>
              <li>
                <Link href="/blog">Blog</Link>
              </li>
              <li>{ARTICLE.category}</li>
              <li>
                <span aria-current="page">{ARTICLE.breadcrumb}</span>
              </li>
            </ol>
          </nav>

          <p className={styles.pills}>
            <span className={styles.categoryPill}>
              <TerminalIcon aria-hidden="true" />
              {ARTICLE.category}
            </span>
            <span className={styles.examplePill}>{LAYOUT_EXAMPLE}</span>
          </p>

          <h1 id="article-titre" className={styles.title}>
            {ARTICLE.title}
          </h1>

          <div className={styles.metaRow}>
            <p className={styles.meta}>
              <span className={styles.metaAvatar} aria-hidden="true">
                {ARTICLE.author.initials}
              </span>
              <span>Par {ARTICLE.author.name}</span>
              <span aria-hidden="true">•</span>
              <span className={styles.metaTime}>
                <ClockIcon aria-hidden="true" />
                {ARTICLE.readingTime}
              </span>
            </p>
            <div className={styles.metaActions}>
              <CopyButton label={ARTICLE.share.copy} className={styles.metaButton} />
              <PendingButton className={styles.metaButton}>
                <BookmarkIcon aria-hidden="true" />
                {ARTICLE.reactions.save}
              </PendingButton>
            </div>
          </div>

          <div className={styles.banner}>
            <NodeCover variant={1} />
            <span className={styles.bannerStamp}>Aperçu illustratif</span>
          </div>
        </div>
      </section>

      {/* Corps + sommaire */}
      <section className={styles.bodySection}>
        <div className={styles.layout}>
          <article id={BODY_ID} className={styles.article} aria-labelledby="article-titre">
            <p className={styles.intro}>{ARTICLE.intro}</p>

            {ARTICLE.sections.map((section) => (
              <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-titre`}>
                <h2 id={`${section.id}-titre`} className={styles.sectionTitle}>
                  {section.title}
                </h2>
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </section>
            ))}

            <footer className={styles.articleFooter}>
              <p className={styles.tags}>
                <span className={styles.tagsLabel}>Mots-clés&nbsp;:</span>
                {ARTICLE.tags.map((tag) => (
                  <span key={tag} className={shared.tag}>
                    {tag}
                  </span>
                ))}
              </p>
              <div className={styles.reactions}>
                <div className={styles.reactionButtons}>
                  {/* Réactions et réponses : actives quand le blog sera relié au compte. */}
                  <PendingButton className={styles.reactionButton}>
                    <HeartIcon aria-hidden="true" />
                    {ARTICLE.reactions.like}
                  </PendingButton>
                  <PendingButton className={styles.reactionButton}>
                    <CommentIcon aria-hidden="true" />
                    {ARTICLE.reactions.reply}
                  </PendingButton>
                </div>
                <ShareLinks title={ARTICLE.title} label={ARTICLE.share.label} />
              </div>
            </footer>
          </article>

          <aside className={styles.aside}>
            <div className={styles.asideSticky}>
              <ArticleToc title={ARTICLE.tocTitle} items={toc} />
              <div className={styles.discussion}>
                <p className={styles.discussionTitle}>
                  <span aria-hidden="true">
                    <ForumIcon />
                  </span>
                  {ARTICLE.discussion.title}
                </p>
                <p className={styles.discussionText}>{ARTICLE.discussion.text}</p>
                <PendingButton className={styles.discussionAction}>
                  {ARTICLE.discussion.action}
                  <ArrowRightIcon aria-hidden="true" />
                </PendingButton>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Lire aussi */}
      <section className={styles.related} aria-labelledby="lire-aussi-titre">
        <div className={sections.container}>
          <header className={styles.relatedHeader}>
            <div>
              <p className={shared.kicker}>{ARTICLE.related.eyebrow}</p>
              <h2 id="lire-aussi-titre" className={styles.relatedTitle}>
                {ARTICLE.related.title}
              </h2>
            </div>
            <Link href="/blog" className={shared.textLink}>
              {ARTICLE.related.all}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </header>
          <ul className={styles.relatedGrid}>
            {related.map((post) => (
              <li key={post.title} className={styles.relatedCard}>
                <p className={styles.relatedMeta}>
                  <span className={styles.examplePill}>{LAYOUT_EXAMPLE}</span>
                  <span>{post.readingTime}</span>
                </p>
                <h3 className={styles.relatedCardTitle}>{post.title}</h3>
                <p className={styles.relatedExcerpt}>{post.excerpt}</p>
                <p className={styles.relatedFooter}>
                  <span>{post.category}</span>
                  <span className={styles.soon}>À paraître</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Appel à contribution */}
      <section className={sections.sectionTight} aria-labelledby="contribuer-titre">
        <div className={sections.container}>
          <div className={`${sections.cta} ${styles.callout}`}>
            <div className={sections.ctaRings} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className={styles.calloutCopy}>
              <p className={styles.calloutEyebrow}>
                <SparklesIcon aria-hidden="true" />
                {ARTICLE.callout.eyebrow}
              </p>
              <h2 id="contribuer-titre" className={styles.calloutTitle}>
                {ARTICLE.callout.title}
              </h2>
              <p className={styles.calloutText}>{ARTICLE.callout.text}</p>
            </div>
            <div className={styles.calloutActions}>
              <PendingButton className={sections.ctaPrimary}>{ARTICLE.callout.primary}</PendingButton>
              <PendingButton className={`${sections.ctaSecondary} ${styles.calloutSecondary}`}>{ARTICLE.callout.secondary}</PendingButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
