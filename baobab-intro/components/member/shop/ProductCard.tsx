"use client";

import Link from "next/link";
import type { Product, ProductKind } from "@/features/shop/types";
import { ROUTES } from "@/lib/routes";
import { coverStyle } from "../learn/CourseCard";
import { cx } from "../ui/cx";
import { BriefcaseIcon, CodeIcon, FileIcon, LearnIcon, ShopIcon, SparklesIcon, StarIcon } from "../ui/icons";
import { Pill } from "../ui/Pill";
import { Skeleton } from "../ui/States";
import { KIND_LABELS, priceOf, STATUS_LABELS } from "./labels";
import styles from "./Shop.module.css";

const KIND_ICONS: Record<ProductKind, typeof ShopIcon> = {
  application: CodeIcon,
  software: CodeIcon,
  service: BriefcaseIcon,
  template: SparklesIcon,
  resource: FileIcon,
  course: LearnIcon,
  digital_content: FileIcon,
};

export function KindIcon({ kind, ...props }: { kind: ProductKind } & React.SVGProps<SVGSVGElement>) {
  const Icon = KIND_ICONS[kind] ?? ShopIcon;
  return <Icon {...props} />;
}

/** Note moyenne réelle (aucune note inventée : « Pas encore d'avis » s'il n'y en a pas). */
export function Stars({ rating, count, compact, single }: { rating: number | null; count: number; compact?: boolean; single?: boolean }) {
  if (!count || rating === null) return compact ? null : <span className={styles.stars}>Pas encore d&apos;avis</span>;
  const rounded = Math.round(rating);
  return (
    <span className={styles.stars} role="img" aria-label={single ? `Note : ${rating} sur 5` : `Note moyenne ${rating.toLocaleString("fr")} sur 5, ${count} avis`}>
      <span className={styles.starRow} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <StarIcon key={i} fill={i <= rounded ? "currentColor" : "none"} data-off={i > rounded || undefined} />
        ))}
      </span>
      {!single && (
        <span aria-hidden="true">
          {rating.toLocaleString("fr", { maximumFractionDigits: 1 })} ({count})
        </span>
      )}
    </span>
  );
}

export function ProductCover({ product, className }: { product: Pick<Product, "title" | "kind" | "media">; className?: string }) {
  const image = product.media.find((m) => m.kind === "image");
  return (
    <div className={cx(styles.cover, className)} style={coverStyle(product.title)} aria-hidden="true">
      {image ? <img src={image.url} alt="" loading="lazy" /> : <KindIcon kind={product.kind} className={styles.coverIcon} />}
    </div>
  );
}

export function ProductCard({ product, showStatus }: { product: Product; showStatus?: boolean }) {
  const price = priceOf(product);
  const status = STATUS_LABELS[product.status];
  return (
    <article className={styles.card}>
      <div style={{ position: "relative" }}>
        <ProductCover product={product} />
        <span className={styles.coverTag}>{KIND_LABELS[product.kind]}</span>
        {showStatus && product.status !== "published" && status && (
          <span className={styles.coverStatus}>
            <Pill tone={status.tone}>{status.label}</Pill>
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link href={ROUTES.product(product.id)} className={styles.link}>
            {product.title}
          </Link>
        </h3>
        <p className={styles.store}>{product.store.name}</p>
        {product.excerpt && <p className={styles.excerpt}>{product.excerpt}</p>}
        <div className={styles.foot}>
          {price ? (
            <span className={styles.price} data-free={price.free || undefined}>
              {price.text}
            </span>
          ) : (
            <span className={styles.store}>Sans prix</span>
          )}
          <Stars rating={product.rating} count={product.rating_count} compact />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div style={{ aspectRatio: "16 / 10" }}>
        <Skeleton height="100%" radius={0} />
      </div>
      <div className={styles.body}>
        <Skeleton width="75%" height={18} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="100%" height={12} />
      </div>
    </div>
  );
}
