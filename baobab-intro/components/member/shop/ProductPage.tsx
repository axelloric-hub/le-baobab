"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useCartMutations, useProduct, useProductMutations, useReviewMutation, useReviews, useWishlistToggle } from "@/features/shop/hooks";
import type { ProductDetail } from "@/features/shop/types";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { relativeTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Field } from "../ui/Field";
import { ArrowLeftIcon, CartIcon, CheckIcon, ExternalIcon, FileIcon, HeartIcon, LearnIcon, LockIcon, ShopIcon, StarIcon, TrashIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { fileSize, KIND_LABELS, LICENSE_LABELS, PLATFORMS, SCOPE_LABELS, STATUS_LABELS } from "./labels";
import { ProductCover, Stars } from "./ProductCard";
import { SellerPanel } from "./ProductEditor";
import { More } from "./ShopPage";
import styles from "./Shop.module.css";

function Gallery({ product }: { product: ProductDetail }) {
  const toast = useToast();
  const { removeMedia } = useProductMutations(product.id);
  const [index, setIndex] = useState(0);
  const media = product.media;
  if (media.length === 0) return <ProductCover product={product} className={styles.stage} />;
  const current = media[Math.min(index, media.length - 1)];
  return (
    <section className={layout.stack} style={{ gap: 10 }} aria-label="Images du produit">
      <div className={styles.stage}>
        {current.kind === "video" ? (
          <video key={current.id} src={current.url} controls preload="metadata" />
        ) : (
          <img key={current.id} src={current.url} alt={`${product.title} — image ${index + 1} sur ${media.length}`} />
        )}
      </div>
      {(media.length > 1 || product.is_mine) && (
        <ul className={styles.thumbs}>
          {media.map((m, i) => (
            <li key={m.id} style={{ position: "relative" }}>
              <button type="button" className={styles.thumb} aria-current={i === index} aria-label={`Afficher l'image ${i + 1}`} onClick={() => setIndex(i)}>
                {m.kind === "video" ? <video src={m.url} preload="metadata" muted /> : <img src={m.url} alt="" loading="lazy" />}
              </button>
              {product.is_mine && (
                <button
                  type="button"
                  className={cx(ui.iconButton, ui.small)}
                  style={{ position: "absolute", top: 4, right: 4, background: "rgba(255,255,255,0.94)" }}
                  aria-label={`Retirer l'image ${i + 1}`}
                  disabled={removeMedia.isPending}
                  onClick={() => {
                    setIndex(0);
                    removeMedia.mutate(m.id, { onError: (e) => toast(describeError(e), { tone: "error" }) });
                  }}
                >
                  <TrashIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BuyCard({ product }: { product: ProductDetail }) {
  const toast = useToast();
  const router = useRouter();
  const { add } = useCartMutations();
  const wish = useWishlistToggle(product.id);
  const offers = product.variants.filter((v) => v.is_active !== false);
  const [selected, setSelected] = useState(offers.find((v) => v.in_stock)?.id ?? offers[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const variant = offers.find((v) => v.id === selected);
  const buyable = product.status === "published" && Boolean(variant?.in_stock);
  const multi = product.kind !== "course"; // l'accès à un cours s'achète une fois

  const addToCart = (then?: () => void) =>
    variant &&
    add.mutate(
      { variant: variant.id, quantity: multi ? quantity : 1 },
      {
        onSuccess: () => {
          if (then) then();
          else toast("Ajouté au panier.", { tone: "success", action: { label: "Voir le panier", onClick: () => router.push(ROUTES.cart) } });
        },
        onError: (e) => toast(describeError(e), { tone: "error" }),
      },
    );

  return (
    <section className={layout.panelCard} aria-labelledby="acheter">
      <h2 id="acheter" className="bb-visually-hidden">
        Acheter
      </h2>
      <div className={layout.stack} style={{ gap: 14 }}>
        {variant && (
          <p className={styles.buyPrice} data-free={variant.price_minor === 0 || undefined}>
            {variant.price_minor === 0 ? "Gratuit" : formatMoney(variant.price_minor * (multi ? quantity : 1), variant.currency)}
          </p>
        )}
        {product.purchased && (
          <p className={styles.notice} style={{ margin: 0 }}>
            <CheckIcon aria-hidden="true" />
            <span>
              Vous avez déjà acheté ce produit.{" "}
              <Link href={`${ROUTES.shop}?onglet=achats`}>Voir mes achats</Link>
            </span>
          </p>
        )}
        {offers.length > 1 && (
          <fieldset className={styles.variantList}>
            <legend className={ui.label}>Offre</legend>
            {offers.map((v) => (
              <label key={v.id} className={styles.variant}>
                <input type="radio" name="variant" value={v.id} checked={selected === v.id} disabled={!v.in_stock} onChange={() => setSelected(v.id)} />
                <span>{v.name}</span>
                <strong>{v.in_stock ? (v.price_minor === 0 ? "Gratuit" : formatMoney(v.price_minor, v.currency)) : "Épuisé"}</strong>
              </label>
            ))}
          </fieldset>
        )}
        {multi && buyable && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={ui.label} style={{ margin: 0 }} id="qty-label">
              {product.license_type === "none" ? "Quantité" : "Postes (licences)"}
            </span>
            <span className={styles.qty} role="group" aria-labelledby="qty-label">
              <button type="button" aria-label="Diminuer" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
                −
              </button>
              <output aria-live="polite">{quantity}</output>
              <button type="button" aria-label="Augmenter" disabled={quantity >= 100} onClick={() => setQuantity((q) => q + 1)}>
                +
              </button>
            </span>
          </div>
        )}
        {product.is_mine ? (
          <p className={ui.hint} style={{ margin: 0 }}>
            Aperçu acheteur : vous ne pouvez pas acheter votre propre produit.
          </p>
        ) : buyable ? (
          <div className={layout.stack} style={{ gap: 8 }}>
            <button type="button" className={cx(ui.button, ui.primary)} disabled={add.isPending} onClick={() => addToCart(() => router.push(ROUTES.cart))}>
              {product.kind === "course" ? "Acheter l'accès" : "Acheter maintenant"}
            </button>
            <button type="button" className={cx(ui.button, ui.secondary)} disabled={add.isPending} onClick={() => addToCart()}>
              <CartIcon />
              Ajouter au panier
            </button>
          </div>
        ) : (
          <p className={ui.hint} style={{ margin: 0 }}>
            {product.status !== "published" ? "Ce produit n'est pas en vente." : "Cette offre est épuisée."}
          </p>
        )}
        {!product.is_mine && (
          <button
            type="button"
            className={cx(ui.button, ui.ghost, ui.small)}
            aria-pressed={product.in_wishlist}
            disabled={wish.isPending}
            onClick={() => wish.mutate(undefined, { onSuccess: (r) => toast(r.in_wishlist ? "Ajouté à vos souhaits." : "Retiré de vos souhaits.", { tone: "success" }) })}
            style={{ alignSelf: "flex-start" }}
          >
            <HeartIcon fill={product.in_wishlist ? "currentColor" : "none"} style={{ color: product.in_wishlist ? "#be123c" : undefined }} />
            {product.in_wishlist ? "Dans vos souhaits" : "Ajouter à mes souhaits"}
          </button>
        )}
        <ul className={styles.checklist}>
          {product.license_type !== "none" && (
            <li>
              <CheckIcon aria-hidden="true" />
              {LICENSE_LABELS[product.license_type]}, clé délivrée après paiement
            </li>
          )}
          {product.latest_release && (
            <li>
              <CheckIcon aria-hidden="true" />
              Fichiers téléchargeables depuis « Mes achats »
            </li>
          )}
          {product.kind === "course" && (
            <li>
              <CheckIcon aria-hidden="true" />
              Accès débloqué dans Learn dès le paiement
            </li>
          )}
          <li>
            <CheckIcon aria-hidden="true" />
            Remboursement possible sous 14 jours
          </li>
        </ul>
      </div>
    </section>
  );
}

function ReviewForm({ productId }: { productId: string }) {
  const toast = useToast();
  const review = useReviewMutation(productId);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    review.mutate({ rating, title: title.trim(), body: body.trim() }, { onSuccess: () => toast("Merci pour votre avis.", { tone: "success" }) });
  };
  return (
    <form className={layout.form} onSubmit={submit} style={{ paddingBottom: 14, borderBottom: "1px solid var(--bb-line)" }}>
      <fieldset className={styles.ratingInput}>
        <legend className={ui.label}>Votre note</legend>
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} data-on={i <= rating || undefined}>
            <input type="radio" name="rating" value={i} checked={rating === i} onChange={() => setRating(i)} />
            <StarIcon fill={i <= rating ? "currentColor" : "none"} />
            <span className="bb-visually-hidden">
              {i} étoile{i > 1 ? "s" : ""}
            </span>
          </label>
        ))}
      </fieldset>
      <Field id="review-title" label="Titre" optional error={fieldError(review.error, "title")}>
        <input id="review-title" className={ui.input} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="review-body" label="Votre avis" optional error={fieldError(review.error, "body")}>
        <textarea id="review-body" className={ui.textarea} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {review.isError && (
        <p className={ui.fieldError} role="alert">
          {describeError(review.error)}
        </p>
      )}
      <button type="submit" className={cx(ui.button, ui.primary, ui.small)} style={{ alignSelf: "flex-start" }} disabled={!rating || review.isPending}>
        Publier mon avis
      </button>
    </form>
  );
}

function Reviews({ product }: { product: ProductDetail }) {
  const reviews = useReviews(product.id);
  const list = useMemo(() => reviews.data?.pages.flatMap((p) => p.results) ?? [], [reviews.data]);
  return (
    <section className={layout.panelCard} aria-labelledby="avis">
      <h2 id="avis" className={layout.panelTitle}>
        <StarIcon aria-hidden="true" />
        Avis des acheteurs
      </h2>
      <div style={{ marginBottom: 12 }}>
        <Stars rating={product.rating} count={product.rating_count} />
      </div>
      {product.purchased && !product.my_review && <ReviewForm productId={product.id} />}
      {reviews.isPending ? (
        <Skeleton height={60} />
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : list.length === 0 ? (
        <p className={ui.hint} style={{ margin: 0 }}>
          Seuls les acheteurs peuvent donner leur avis : aucun pour l&apos;instant.
        </p>
      ) : (
        <div>
          {list.map((r) => (
            <article key={r.id} className={styles.review}>
              <div className={styles.reviewHead}>
                <Avatar name={r.user.display_name || r.user.username} src={r.user.avatar_url} size={28} />
                <strong>{r.user.display_name || r.user.username}</strong>
                <Stars rating={r.rating} count={1} single />
                <span className={ui.hint} style={{ margin: 0 }}>
                  {relativeTime(r.created_at)}
                </span>
              </div>
              {r.title && <strong style={{ color: "var(--bb-brown-950)" }}>{r.title}</strong>}
              {r.body && <p className={styles.prose} style={{ fontSize: 14.5 }}>{r.body}</p>}
            </article>
          ))}
          <More query={reviews} label="Afficher plus d'avis" />
        </div>
      )}
    </section>
  );
}

export function ProductPage({ id }: { id: string }) {
  const query = useProduct(id);
  if (query.isPending) {
    return (
      <div className={layout.page}>
        <Skeleton height={320} radius={18} />
        <Skeleton height={160} radius={18} />
      </div>
    );
  }
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={ROUTES.shop} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Boutique
        </Link>
        {gone ? <EmptyState icon={<LockIcon />} title="Produit introuvable" text="Ce produit n'existe pas ou n'est plus en vente." /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }
  const p = query.data;
  const status = STATUS_LABELS[p.status];
  const rel = p.latest_release;
  return (
    <div className={layout.page}>
      <Link href={p.is_mine ? ROUTES.store(p.store.slug) : ROUTES.shop} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        {p.is_mine ? p.store.name : "Boutique"}
      </Link>
      <div className={styles.productGrid}>
        <div className={cx(layout.stack, styles.areaTop)}>
          <Gallery product={p} />
          <header className={layout.stack} style={{ gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Pill tone="brown">{KIND_LABELS[p.kind]}</Pill>
              {p.is_mine && status && <Pill tone={status.tone}>{status.label}</Pill>}
            </div>
            <h1 className={styles.heroTitle}>{p.title}</h1>
            <ul className={styles.heroMeta}>
              <li>
                <ShopIcon aria-hidden="true" />
                <Link href={ROUTES.store(p.store.slug)}>{p.store.name}</Link>
              </li>
              <li>
                <Avatar name={p.owner.display_name || p.owner.username} src={p.owner.avatar_url} size={24} />
                <Link href={ROUTES.profile(p.owner.username)}>{p.owner.display_name || p.owner.username}</Link>
              </li>
              <li>
                <Stars rating={p.rating} count={p.rating_count} />
              </li>
            </ul>
          </header>
        </div>

        <aside className={cx(styles.side, styles.areaSide)} aria-label="Achat">
          {p.is_mine && <SellerPanel product={p} />}
          <BuyCard key={p.variants.map((v) => v.id).join()} product={p} />
        </aside>

        <div className={cx(layout.stack, styles.areaMain)}>
          <section className={layout.panelCard} aria-labelledby="description">
            <h2 id="description" className={layout.panelTitle}>
              Description
            </h2>
            {p.description ? <p className={styles.prose}>{p.description}</p> : <p className={ui.hint}>Pas encore de description.</p>}
            {p.skills.length > 0 && (
              <ul className={layout.chips} style={{ flexWrap: "wrap", margin: "14px 0 0", padding: 0, listStyle: "none" }} aria-label="Technologies">
                {p.skills.map((s) => (
                  <li key={s.slug}>
                    <Pill tone="blue">{s.name}</Pill>
                  </li>
                ))}
              </ul>
            )}
            {p.documentation_url && (
              <a href={p.documentation_url} target="_blank" rel="noopener noreferrer nofollow" className={cx(ui.button, ui.ghost, ui.small)} style={{ marginTop: 12 }}>
                Documentation
                <ExternalIcon />
              </a>
            )}
          </section>

          {p.targets.length > 0 && (
            <section className={layout.panelCard} aria-labelledby="debloque">
              <h2 id="debloque" className={layout.panelTitle}>
                <LearnIcon aria-hidden="true" />
                Ce que l&apos;achat débloque
              </h2>
              <div className={layout.stack} style={{ gap: 8 }}>
                {p.targets.map((t) => (
                  <div key={t.id} className={styles.fileRow}>
                    <LearnIcon aria-hidden="true" width={18} height={18} />
                    <span>
                      {t.course ? <Link href={ROUTES.course(t.course)}>{t.label ?? "Contenu Learn"}</Link> : t.classroom ? <Link href={ROUTES.classroom(t.classroom)}>{t.label}</Link> : <strong>{t.label ?? "Contenu Learn"}</strong>}
                      <small style={{ display: "block" }}>{SCOPE_LABELS[t.scope]} dans Learn</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {rel && (
            <section className={layout.panelCard} aria-labelledby="version">
              <h2 id="version" className={layout.panelTitle}>
                <FileIcon aria-hidden="true" />
                Version {rel.version} · {PLATFORMS[rel.platform] ?? rel.platform}
              </h2>
              <div className={layout.stack} style={{ gap: 12 }}>
                {rel.changelog && (
                  <div>
                    <strong>Nouveautés</strong>
                    <p className={styles.prose} style={{ fontSize: 14.5 }}>
                      {rel.changelog}
                    </p>
                  </div>
                )}
                {rel.requirements && (
                  <div>
                    <strong>Prérequis</strong>
                    <p className={styles.prose} style={{ fontSize: 14.5 }}>
                      {rel.requirements}
                    </p>
                  </div>
                )}
                {rel.installation_instructions && (
                  <div>
                    <strong>Installation</strong>
                    <p className={styles.prose} style={{ fontSize: 14.5 }}>
                      {rel.installation_instructions}
                    </p>
                  </div>
                )}
                {rel.files.map((f) => (
                  <div key={f.id} className={styles.fileRow}>
                    <FileIcon aria-hidden="true" width={18} height={18} />
                    <span>
                      <strong>{f.filename}</strong>
                      <small title={f.checksum_sha256}>
                        {fileSize(f.size_bytes)} · SHA-256 {f.checksum_sha256.slice(0, 12)}…
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Reviews product={p} />
        </div>
      </div>
    </div>
  );
}
