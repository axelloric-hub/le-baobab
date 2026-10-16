"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useOrder, useOrderPayment, usePaymentConfig, useRefunds } from "@/features/shop/hooks";
import type { Order, OrderItem } from "@/features/shop/types";
import { ApiError, describeError } from "@/lib/api/errors";
import { fullDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { coverStyle } from "../learn/CourseCard";
import { ConfirmDialog } from "../post/PostDialogs";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { ArrowLeftIcon, CheckIcon, ClockIcon, KeyIcon, LearnIcon, LockIcon, ReceiptIcon, SparklesIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { KIND_LABELS, ORDER_STATUS } from "./labels";
import { KindIcon } from "./ProductCard";
import styles from "./Shop.module.css";

const REFUND_DAYS = 14;
const REFUND_STATUS: Record<string, { label: string; tone: "amber" | "green" | "neutral" }> = {
  requested: { label: "Remboursement demandé", tone: "amber" },
  processed: { label: "Remboursé", tone: "green" },
  rejected: { label: "Remboursement refusé", tone: "neutral" },
};

function PaymentPanel({ order }: { order: Order }) {
  const toast = useToast();
  const config = usePaymentConfig();
  const pay = useOrderPayment(order.id);
  const [cancelling, setCancelling] = useState(false);
  const busy = pay.start.isPending || pay.simulate.isPending || pay.payFree.isPending;
  const failed = order.payment?.status === "failed";

  const simulate = async (outcome: "succeeded" | "failed") => {
    try {
      const payment = await pay.start.mutateAsync("manual");
      const result = await pay.simulate.mutateAsync({ payment: payment.id, outcome });
      if (result.order.status === "paid") toast("Paiement accepté : merci pour votre achat !", { tone: "success" });
      else toast("Le paiement a échoué. Vous pouvez réessayer.", { tone: "error" });
    } catch (error) {
      toast(describeError(error), { tone: "error" });
    }
  };

  return (
    <section className={layout.panelCard} aria-labelledby="paiement">
      <h2 id="paiement" className={layout.panelTitle}>
        <LockIcon aria-hidden="true" />
        Paiement
      </h2>
      <div className={layout.stack} style={{ gap: 12 }}>
        {order.total_minor === 0 ? (
          <>
            <p style={{ margin: 0 }}>Cette commande est gratuite : validez-la pour obtenir votre accès.</p>
            <button
              type="button"
              className={cx(ui.button, ui.primary)}
              disabled={busy}
              onClick={() => pay.payFree.mutate(undefined, { onSuccess: () => toast("Commande validée.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) })}
            >
              <CheckIcon />
              Valider la commande
            </button>
          </>
        ) : config.isPending ? (
          <Skeleton height={80} />
        ) : (
          <>
            {failed && (
              <p className={styles.notice} style={{ margin: 0 }}>
                <ClockIcon aria-hidden="true" />
                Le dernier paiement a échoué. Aucun montant n&apos;a été débité : vous pouvez réessayer.
              </p>
            )}
            <fieldset className={layout.choices}>
              <legend className={ui.label}>Moyen de paiement</legend>
              {(config.data?.providers ?? []).map((p) => (
                <label key={p.code} className={layout.choice} aria-disabled="true" style={{ opacity: 0.6, cursor: "not-allowed" }}>
                  <input type="radio" name="provider" disabled />
                  <span>
                    <strong>{p.label}</strong>
                    <small>Bientôt disponible</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {config.data?.simulation ? (
              <>
                <p className={styles.notice} style={{ margin: 0 }}>
                  <SparklesIcon aria-hidden="true" />
                  <span>
                    <strong>Phase de test :</strong> aucun moyen de paiement réel n&apos;est encore branché. Simulez le résultat du paiement pour tester le parcours complet (licence, accès,
                    téléchargements) ; aucun argent n&apos;est débité.
                  </span>
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" className={cx(ui.button, ui.primary)} disabled={busy} onClick={() => void simulate("succeeded")}>
                    <CheckIcon />
                    {busy ? "Paiement…" : `Payer ${formatMoney(order.total_minor, order.currency)} (test)`}
                  </button>
                  <button type="button" className={cx(ui.button, ui.ghost)} disabled={busy} onClick={() => void simulate("failed")}>
                    Simuler un échec
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.notice} style={{ margin: 0 }}>
                <ClockIcon aria-hidden="true" />
                Le paiement en ligne (Mobile Money, carte) ouvre prochainement. Votre commande reste réservée quelques heures, puis elle est annulée automatiquement.
              </p>
            )}
          </>
        )}
        <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => setCancelling(true)} disabled={busy}>
          Annuler la commande
        </button>
      </div>
      <ConfirmDialog
        open={cancelling}
        busy={pay.cancel.isPending}
        onClose={() => setCancelling(false)}
        title="Annuler cette commande ?"
        text="Les articles réservés sont remis en vente et le code promo éventuel vous est rendu."
        confirm="Annuler la commande"
        onConfirm={() =>
          pay.cancel.mutate(undefined, {
            onSuccess: () => {
              setCancelling(false);
              toast("Commande annulée.", { tone: "success" });
            },
            onError: (e) => toast(describeError(e), { tone: "error" }),
          })
        }
      />
    </section>
  );
}

function RefundDialog({ order, item, onClose }: { order: Order; item: OrderItem | null; onClose: () => void }) {
  const toast = useToast();
  const { refund } = useOrderPayment(order.id);
  const [reason, setReason] = useState("");
  if (!item) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return;
    refund.mutate(
      { item: item.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast("Demande envoyée : l'équipe LE BAOBAB vous répond rapidement.", { tone: "success" });
          onClose();
        },
      },
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      busy={refund.isPending}
      title="Demander un remboursement"
      footer={
        <button type="submit" form="refund-form" className={cx(ui.button, ui.primary)} disabled={reason.trim().length < 5 || refund.isPending}>
          {refund.isPending ? "Envoi…" : "Envoyer la demande"}
        </button>
      }
    >
      <form id="refund-form" className={layout.form} onSubmit={submit}>
        <p style={{ margin: 0 }}>
          <strong>{item.title}</strong> · {formatMoney(item.line_total_minor - item.discount_minor - item.refunded_minor, order.currency)}
        </p>
        <Field id="refund-reason" label="Motif" hint="Expliquez ce qui ne va pas : la demande est examinée par l'équipe. Si elle est acceptée, la licence et l'accès sont retirés.">
          <textarea id="refund-reason" data-autofocus className={ui.textarea} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {refund.isError && (
          <p className={ui.fieldError} role="alert">
            {describeError(refund.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export function OrderPage({ id }: { id: string }) {
  const query = useOrder(id);
  const paid = query.data && (query.data.status === "paid" || query.data.status === "partially_refunded");
  const refunds = useRefunds(Boolean(paid));
  const [refunding, setRefunding] = useState<OrderItem | null>(null);

  if (query.isPending) {
    return (
      <div className={layout.page}>
        <Skeleton height={260} radius={18} />
      </div>
    );
  }
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={`${ROUTES.shop}?onglet=achats`} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Mes achats
        </Link>
        {gone ? <EmptyState icon={<ReceiptIcon />} title="Commande introuvable" /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }
  const o = query.data;
  const status = ORDER_STATUS[o.status];
  const refundOpen = paid && o.paid_at && Date.now() - new Date(o.paid_at).getTime() < REFUND_DAYS * 86_400_000 && o.total_minor > 0;
  const refundOf = (item: string) => refunds.data?.find((r) => r.order_item === item);

  return (
    <div className={layout.page}>
      <Link href={`${ROUTES.shop}?onglet=achats`} className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }}>
        <ArrowLeftIcon />
        Mes achats
      </Link>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <ReceiptIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Commande {o.number}</h1>
            <p className={layout.pageLead}>
              Passée le {fullDate(o.created_at)}
              {o.paid_at && ` · payée le ${fullDate(o.paid_at)}`}
            </p>
          </div>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </header>

      {paid && (
        <p className={styles.notice} style={{ margin: 0 }} role="status">
          <CheckIcon aria-hidden="true" />
          <span>
            Merci pour votre achat ! Vos licences et vos fichiers sont dans <Link href={`${ROUTES.shop}?onglet=achats`}>Mes achats</Link>
            {o.items.some((i) => i.kind === "course") && <> ; l&apos;accès aux formations est débloqué dans <Link href={ROUTES.learn}>Learn</Link></>}.
          </span>
        </p>
      )}

      <div className={styles.split}>
        <ul className={styles.lines} aria-label="Articles">
          {o.items.map((item) => {
            const refund = refundOf(item.id);
            const refundable = refundOpen && item.refunded_minor < item.line_total_minor - item.discount_minor && !refund;
            return (
              <li key={item.id} className={styles.line}>
                <span className={styles.lineThumb} style={coverStyle(item.title)} aria-hidden="true">
                  <KindIcon kind={item.kind} />
                </span>
                <div className={styles.lineMain}>
                  <span className={styles.lineText}>
                    <Link href={ROUTES.product(item.product)}>{item.title}</Link>
                    <small>
                      {KIND_LABELS[item.kind]} · {item.shop.name} · {item.quantity} × {item.unit_price_minor === 0 ? "Gratuit" : formatMoney(item.unit_price_minor, o.currency)}
                    </small>
                    {item.discount_minor > 0 && <small>Remise : −{formatMoney(item.discount_minor, o.currency)}</small>}
                    {item.refunded_minor > 0 && <small>Remboursé : {formatMoney(item.refunded_minor, o.currency)}</small>}
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {paid && item.kind === "course" && (
                        <Link href={ROUTES.product(item.product)} className={cx(ui.button, ui.ghost, ui.small)}>
                          <LearnIcon />
                          Accéder à la formation
                        </Link>
                      )}
                      {paid && item.kind !== "course" && item.kind !== "service" && (
                        <Link href={`${ROUTES.shop}?onglet=achats`} className={cx(ui.button, ui.ghost, ui.small)}>
                          <KeyIcon />
                          Licence et fichiers
                        </Link>
                      )}
                      {refund && <Pill tone={REFUND_STATUS[refund.status]?.tone ?? "neutral"}>{REFUND_STATUS[refund.status]?.label ?? refund.status}</Pill>}
                      {refundable && (
                        <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => setRefunding(item)}>
                          Demander un remboursement
                        </button>
                      )}
                    </span>
                  </span>
                  <span className={styles.lineEnd}>
                    <span className={styles.lineTotal}>{item.line_total_minor === 0 ? "Gratuit" : formatMoney(item.line_total_minor - item.discount_minor, o.currency)}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className={styles.side} aria-label="Total et paiement">
          <section className={layout.panelCard} aria-labelledby="total">
            <h2 id="total" className={layout.panelTitle}>
              Total
            </h2>
            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt>Sous-total</dt>
                <dd>{formatMoney(o.subtotal_minor, o.currency)}</dd>
              </div>
              {o.discount_minor > 0 && (
                <div className={styles.summaryRow}>
                  <dt>Remise</dt>
                  <dd>−{formatMoney(o.discount_minor, o.currency)}</dd>
                </div>
              )}
              <div className={cx(styles.summaryRow, styles.summaryTotal)}>
                <dt>Total</dt>
                <dd>{o.total_minor === 0 ? "Gratuit" : formatMoney(o.total_minor, o.currency)}</dd>
              </div>
            </dl>
          </section>
          {o.status === "pending" && <PaymentPanel order={o} />}
          {o.status === "cancelled" && (
            <p className={styles.notice} style={{ margin: 0 }}>
              <ClockIcon aria-hidden="true" />
              Commande annulée{o.cancelled_at ? ` le ${fullDate(o.cancelled_at)}` : ""}. Rien n&apos;a été débité.
            </p>
          )}
        </aside>
      </div>
      <RefundDialog key={refunding?.id ?? "none"} order={o} item={refunding} onClose={() => setRefunding(null)} />
    </div>
  );
}
