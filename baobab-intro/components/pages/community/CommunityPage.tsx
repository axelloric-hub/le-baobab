import {
  ArrowRightIcon,
  BlockIcon,
  CheckIcon,
  CommentIcon,
  EyeIcon,
  ForumIcon,
  HeartIcon,
  ShareIcon,
  ShieldIcon,
  SparklesIcon,
  TerminalIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import sections from "@/components/landing/sections/Sections.module.css";
import { CodeBlock } from "../shared/CodeBlock";
import { PageCta } from "../shared/PageCta";
import shared from "../shared/Pages.module.css";
import {
  COMMUNITY_CTA,
  COMMUNITY_FEED_POST,
  COMMUNITY_HELP,
  COMMUNITY_HERO,
  COMMUNITY_PRIVACY,
  COMMUNITY_TOOLS,
  ILLUSTRATIVE,
  type CommunityToolIcon,
} from "./community-content";
import { VisibilityPicker } from "./VisibilityPicker";
import styles from "./Community.module.css";

const TOOL_ICONS: Record<CommunityToolIcon, typeof UsersIcon> = {
  groups: UsersIcon,
  forum: ForumIcon,
  terminal: TerminalIcon,
  shield: ShieldIcon,
};

const ACTION_ICONS = [HeartIcon, CommentIcon, ShareIcon];
const BADGE_ICONS = [BlockIcon, EyeIcon, TrashIcon];

function FeedPreview() {
  const post = COMMUNITY_FEED_POST;
  return (
    <figure className={`${shared.mock} ${styles.feed}`} aria-label="Exemple de publication dans le fil de la communauté">
      <div className={styles.postHeader}>
        <span className={shared.avatar}>{post.initials}</span>
        <div className={styles.postAuthorBlock}>
          <p className={styles.postAuthor}>
            <span>{post.author}</span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.postWhen}>{post.when}</span>
          </p>
          <span className={shared.tag}>{post.tag}</span>
        </div>
      </div>
      <p className={styles.postText}>{post.text}</p>
      <CodeBlock code={post.code} filename={post.filename} language={post.language} compact />
      <ul className={styles.postActions} aria-label="Actions (aperçu)">
        {post.actions.map((action, index) => {
          const Icon = ACTION_ICONS[index] ?? HeartIcon;
          return (
            <li key={action}>
              <Icon aria-hidden="true" />
              {action}
            </li>
          );
        })}
      </ul>
      <div className={styles.reply}>
        <span className={shared.avatar} data-size="sm" data-tone="blue">
          {post.reply.initials}
        </span>
        <p>
          <strong>{post.reply.author}&nbsp;:</strong> {post.reply.before}
          <code className={shared.inlineCode}>{post.reply.code}</code>
          {post.reply.after}
        </p>
      </div>
      <figcaption className={shared.illustrative}>{ILLUSTRATIVE}</figcaption>
    </figure>
  );
}

function ThreadPreview() {
  const { thread } = COMMUNITY_HELP;
  return (
    <figure className={`${shared.mock} ${styles.thread}`} aria-label="Exemple de fil de discussion technique">
      <div className={styles.threadHeader}>
        <span className={styles.threadIcon} aria-hidden="true">
          <ForumIcon />
        </span>
        <div>
          <span className={styles.threadLabel}>{thread.label}</span>
          <span className={styles.threadChannel}>{thread.channel}</span>
        </div>
        <span className={styles.threadStatus}>{thread.status}</span>
      </div>
      <div className={styles.question}>
        <p className={styles.messageMeta}>
          <span className={shared.avatar} data-size="sm" data-tone="brown">
            {thread.question.initials}
          </span>
          <strong>{thread.question.author}</strong>
          <span>{thread.question.time}</span>
        </p>
        <p className={styles.messageText}>{thread.question.text}</p>
      </div>
      <div className={styles.answer}>
        <p className={styles.messageMeta}>
          <span className={shared.avatar} data-size="sm" data-tone="blue">
            {thread.answer.initials}
          </span>
          <strong>{thread.answer.author}</strong>
          <span className={styles.answerBadge}>{thread.answer.badge}</span>
          <span className={styles.messageTime}>{thread.answer.time}</span>
        </p>
        <p className={styles.messageText}>{thread.answer.text}</p>
        <CodeBlock code={thread.answer.code} compact label="Extrait de code de la réponse" />
      </div>
      <figcaption className={shared.illustrative}>{ILLUSTRATIVE}</figcaption>
    </figure>
  );
}

export function CommunityPage() {
  return (
    <>
      {/* 1. Héros */}
      <section className={shared.hero} aria-labelledby="communaute-titre">
        <div className={shared.gridPattern} aria-hidden="true" />
        <div className={`${sections.container} ${shared.heroGrid}`}>
          <div className={shared.heroCopy}>
            <p className={shared.badge}>
              <SparklesIcon aria-hidden="true" />
              {COMMUNITY_HERO.badge}
            </p>
            <h1 id="communaute-titre" className={shared.heroTitle}>
              {COMMUNITY_HERO.title}
            </h1>
            <p className={shared.heroSubtitle}>{COMMUNITY_HERO.subtitle}</p>
            <p className={shared.heroLead}>{COMMUNITY_HERO.lead}</p>
            {/* Inscription pas encore raccordée : bouton visuel, sans action. */}
            <PendingButton className={shared.primaryButton}>
              {COMMUNITY_HERO.cta}
              <ArrowRightIcon aria-hidden="true" />
            </PendingButton>
          </div>
          <FeedPreview />
        </div>
      </section>

      {/* 2. Outils & échanges */}
      <section className={shared.band} data-tone="deep" aria-labelledby="outils-titre">
        <div className={sections.container}>
          <div className={`${shared.shell} ${sections.reveal}`}>
            <header className={sections.heading}>
              <p className={sections.eyebrow}>{COMMUNITY_TOOLS.eyebrow}</p>
              <h2 id="outils-titre" className={sections.title}>
                {COMMUNITY_TOOLS.title}
              </h2>
              <p className={sections.lead}>{COMMUNITY_TOOLS.lead}</p>
            </header>
            <ul className={styles.toolGrid}>
              {COMMUNITY_TOOLS.items.map((item) => {
                const Icon = TOOL_ICONS[item.icon];
                return (
                  <li key={item.title} className={styles.toolCard}>
                    <span className={styles.toolIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <h3 className={styles.toolTitle}>{item.title}</h3>
                    <p className={styles.toolText}>{item.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Entraide entre pairs */}
      <section className={shared.band} aria-labelledby="entraide-titre">
        <div className={`${sections.container} ${shared.split}`} data-reverse="">
          <div className={`${shared.splitCopy} ${sections.reveal}`}>
            <p className={shared.kicker}>{COMMUNITY_HELP.eyebrow}</p>
            <h2 id="entraide-titre" className={shared.splitTitle}>
              {COMMUNITY_HELP.title}
            </h2>
            <p className={shared.splitText}>{COMMUNITY_HELP.text}</p>
            <ul className={shared.checks}>
              {COMMUNITY_HELP.points.map((point) => (
                <li key={point}>
                  <span className={shared.checkDot} aria-hidden="true">
                    <CheckIcon />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className={sections.reveal}>
            <ThreadPreview />
          </div>
        </div>
      </section>

      {/* 4. Confidentialité */}
      <section className={shared.band} data-tone="sand" aria-labelledby="confidentialite-titre">
        <div className={sections.container}>
          <div className={`${shared.shell} ${shared.split} ${sections.reveal}`} data-reverse="">
            <div className={shared.splitCopy}>
              <p className={shared.kicker}>{COMMUNITY_PRIVACY.eyebrow}</p>
              <h2 id="confidentialite-titre" className={shared.splitTitle}>
                {COMMUNITY_PRIVACY.title}
              </h2>
              <p className={shared.splitText}>{COMMUNITY_PRIVACY.text}</p>
              <ul className={shared.chips}>
                {COMMUNITY_PRIVACY.badges.map((badge, index) => {
                  const Icon = BADGE_ICONS[index] ?? ShieldIcon;
                  return (
                    <li key={badge} className={shared.chip}>
                      <Icon aria-hidden="true" />
                      {badge}
                    </li>
                  );
                })}
              </ul>
            </div>
            <VisibilityPicker />
          </div>
        </div>
      </section>

      {/* 5. Bandeau final */}
      <PageCta id="rejoindre" title={COMMUNITY_CTA.title} text={COMMUNITY_CTA.text} primary={COMMUNITY_CTA.primary} />
    </>
  );
}
