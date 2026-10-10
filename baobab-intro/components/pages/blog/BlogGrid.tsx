"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRightIcon } from "@/components/landing/icons";
import { NodeCover } from "../shared/NodeCover";
import {
  BLOG_ALL_LABEL,
  BLOG_CATEGORIES,
  BLOG_GRID,
  BLOG_HERO,
  BLOG_POSTS,
  LAYOUT_EXAMPLE,
  type BlogCategory,
} from "./blog-content";
import styles from "./Blog.module.css";

type Filter = BlogCategory | typeof BLOG_ALL_LABEL;

/** Filtres thématiques du héros (rendus ici) — ils filtrent réellement la grille. */
export function BlogFilters({ value, onChange }: { value: Filter; onChange: (filter: Filter) => void }) {
  return (
    <div className={styles.filters} role="group" aria-label={BLOG_HERO.filtersLabel}>
      {[BLOG_ALL_LABEL, ...BLOG_CATEGORIES].map((filter) => (
        <button
          key={filter}
          type="button"
          className={styles.filter}
          aria-pressed={value === filter}
          aria-controls="blog-articles"
          onClick={() => onChange(filter as Filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

/**
 * Héros (filtres) + grille des articles annoncés : un seul composant client
 * pour que les filtres du haut pilotent la grille plus bas.
 */
export function BlogExplorer({ hero, featured, notice }: { hero: ReactNode; featured: ReactNode; notice?: ReactNode }) {
  const [filter, setFilter] = useState<Filter>(BLOG_ALL_LABEL);
  const posts = filter === BLOG_ALL_LABEL ? BLOG_POSTS : BLOG_POSTS.filter((post) => post.category === filter);

  return (
    <>
      <section className={styles.hero} aria-labelledby="blog-titre">
        {hero}
        <div className={styles.heroFilters}>
          <BlogFilters value={filter} onChange={setFilter} />
        </div>
      </section>

      {featured}

      <section className={styles.gridSection} aria-labelledby="dossiers-titre">
        <div className={styles.container}>
          <header className={styles.gridHeader}>
            <div>
              <p className={styles.gridEyebrow}>{BLOG_GRID.eyebrow}</p>
              <h2 id="dossiers-titre" className={styles.gridTitle}>
                {BLOG_GRID.title}
              </h2>
            </div>
            <p className={styles.gridLead}>{BLOG_GRID.lead}</p>
          </header>

          <p className="bb-visually-hidden" role="status">
            {filter === BLOG_ALL_LABEL ? "" : `${posts.length} article${posts.length > 1 ? "s" : ""} : ${filter}`}
          </p>

          {posts.length === 0 ? (
            <p className={styles.empty}>{BLOG_GRID.empty}</p>
          ) : (
            <ul id="blog-articles" className={styles.grid}>
              {posts.map((post) => {
                const variant = BLOG_POSTS.indexOf(post);
                return (
                  <li key={post.title}>
                    <article className={styles.card} data-linked={post.slug ? "" : undefined}>
                      <div className={styles.cardCover}>
                        <NodeCover variant={variant} />
                        <span className={styles.coverStamp}>{LAYOUT_EXAMPLE}</span>
                      </div>
                      <div className={styles.cardBody}>
                        <p className={styles.cardMeta}>
                          <span className={styles.category}>{post.category}</span>
                          <span>{post.readingTime}</span>
                        </p>
                        <h3 className={styles.cardTitle}>
                          {post.slug ? (
                            <Link href={`/blog/${post.slug}`} className={styles.cardLink}>
                              {post.title}
                            </Link>
                          ) : (
                            post.title
                          )}
                        </h3>
                        <p className={styles.cardExcerpt}>{post.excerpt}</p>
                      </div>
                      <p className={styles.cardFooter}>
                        <span className={styles.cardTags}>{post.tags}</span>
                        {post.slug ? (
                          <span className={styles.cardRead} aria-hidden="true">
                            {BLOG_GRID.readModel}
                            <ArrowRightIcon />
                          </span>
                        ) : (
                          <span className={styles.cardSoon}>À paraître</span>
                        )}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      {notice}
    </>
  );
}
