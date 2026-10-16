"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useCart, useCartMutations } from "@/features/shop/hooks";
import { describeError } from "@/lib/api/errors";
import { plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { coverStyle } from "../learn/CourseCard";
import { cx } from "../ui/cx";
import { ArrowLeftIcon, CartIcon, LockIcon, SparklesIcon, TagIcon, TrashIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { KIND_LABELS } from "./labels";
import { KindIcon } from "./ProductCard";
import styles from "./Shop.module.css";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function CartPage() {
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const { set, remove, checkout } = useCartMutations();
  const [coupon, setCoupon] = useState("");
  // Une clé d'idempotence par tentative : deux clics sur « Commander » ne créent jamais deux commandes.
  const key = useRef(newKey());

  if (cart.isPending) {
    return (
      <div className={layout.page}>
        <Skeleton height={240} radius={18} />
      </div>
    );
  }
  if (cart.isError) {
    return (
      <div className={layout.page}>
        <ErrorState error={cart.error} onRetry={() => cart.refetch()} />
      </div>
    );
  }
  const c = cart.data;
  const blocked = c.items.some((i) => !i.available || !i.in_stock);
  const busy = set.isPending || remove.isPending;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (blocked || checkout.isPending) return;
    checkout.mutate(
      { key: key.current, coupon: coupon.trim() },
      {
        onSuccess: (order) => {
          key.current = newKey();
          router.push(ROUTES.order(order.id));
        },
        onError: () => {
          key.current = newKey();
        },
      },
    );
  };

  return (
    <div className={layout.page}>
      <Link href={ROUTES.shop} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        Continuer mes achats
      </Link>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <CartIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Panier</h1>
            <p className={layout.pageLead}>{c.count ? plural(c.count, "article", "articles") : "Votre panier est vide."}</p>
          </div>
        </div>
      </header>
      {c.items.length === 0 ? (
        <EmptyState
          icon={<CartIcon />}
          title="Votre panier est vide"
          text="Ajoutez des produits depuis le catalogue de la Boutique."
          actions={
            <Link href={ROUTES.shop} className={cx(ui.button, ui.primary)}>
              <SparklesIcon />
              Parcourir le catalogue
            </Link>
          }
        />
      ) : (
        <div className={styles.split}>
          <ul className={styles.lines} aria-label="Articles du panier">
            {c.items.map((line) => (
              <li key={line.variant} className={styles.line}>
                <span className={styles.lineThumb} style={coverStyle(line.product)} aria-hidden="true">
                  <KindIcon kind={line.kind} />
                </span>
                <div className={styles.lineMain}>
                  <span className={styles.lineText}>
                    <Link href={ROUTES.product(line.product_id)}>{line.product}</Link>
                    <small>
                      {KIND_LABELS[line.kind]} · {line.variant_name} · {line.store.name}
                    </small>
                    <small>{line.unit_price_minor === 0 ? "Gratuit" : `${formatMoney(line.unit_price_minor, line.currency)} l'unité`}</small>
                    {!line.available && <Pill tone="red">Plus disponible : retirez-le</Pill>}
                    {line.available && !line.in_stock && <Pill tone="amber">Stock insuffisant : réduisez la quantité</Pill>}
                  </span>
                  <span className={styles.lineEnd}>
                    {line.kind !== "course" && (
                      <span className={styles.qty} role="group" aria-label={`Quantité de ${line.product}`}>
                        <button
                          type="button"
                          aria-label="Diminuer"
                          disabled={busy || line.quantity <= 1}
                          onClick={() => set.mutate({ variant: line.variant, quantity: line.quantity - 1 }, { onError: (e) => toast(describeError(e), { tone: "error" }) })}
                        >
                          −
                        </button>
                        <output aria-live="polite">{line.quantity}</output>
                        <button
                          type="button"
                          aria-label="Augmenter"
                          disabled={busy || line.quantity >= 100}
                          onClick={() => set.mutate({ variant: line.variant, quantity: line.quantity + 1 }, { onError: (e) => toast(describeError(e), { tone: "error" }) })}
                        >
                          +
                        </button>
                      </span>
                    )}
                    <span className={styles.lineTotal}>{line.line_total_minor === 0 ? "Gratuit" : formatMoney(line.line_total_minor, line.currency)}</span>
                    <button type="button" className={ui.iconButton} aria-label={`Retirer ${line.product} du panier`} disabled={busy} onClick={() => remove.mutate(line.variant)}>
                      <TrashIcon />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <aside className={styles.side} aria-label="Récapitulatif">
            <form className={layout.panelCard} onSubmit={submit}>
              <h2 className={layout.panelTitle}>Récapitulatif</h2>
              <dl className={styles.summary}>
                <div className={styles.summaryRow}>
                  <dt>Sous-total</dt>
                  <dd>{formatMoney(c.subtotal_minor, c.currency ?? "XAF")}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Remise</dt>
                  <dd>{coupon.trim() ? "calculée à la commande" : "—"}</dd>
                </div>
              </dl>
              <div style={{ marginTop: 14 }}>
                <label className={ui.label} htmlFor="coupon">
                  Code promo <span style={{ fontWeight: 500, color: "var(--bb-ink-muted)" }}>(facultatif)</span>
                </label>
                <div className={layout.searchBox}>
                  <TagIcon />
                  <input id="coupon" className={ui.input} maxLength={40} autoComplete="off" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
                </div>
              </div>
              {checkout.isError && (
                <p className={ui.fieldError} role="alert">
                  {describeError(checkout.error)}
                </p>
              )}
              <button type="submit" className={cx(ui.button, ui.primary)} style={{ width: "100%", marginTop: 14 }} disabled={blocked || checkout.isPending}>
                <LockIcon />
                {checkout.isPending ? "Création de la commande…" : "Commander"}
              </button>
              <p className={ui.hint} style={{ marginBottom: 0 }}>
                Les prix sont figés à la commande. Le paiement se fait à l&apos;étape suivante.
              </p>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
