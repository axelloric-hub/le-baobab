"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRevenue, useSales, useStore, useStoreMutations } from "@/features/shop/hooks";
import type { StoreDetail } from "@/features/shop/types";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { fullDate, plural } from "@/lib/format";
import { CURRENCIES, formatMoney, toMinor } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { EntityHeader, EntityHeaderSkeleton } from "../ui/EntityHeader";
import { Field } from "../ui/Field";
import { ArrowLeftIcon, CalendarIcon, PenIcon, PlusIcon, ReceiptIcon, ShopIcon, TagIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { ORDER_STATUS } from "./labels";
import { ProductCard } from "./ProductCard";
import { CreateProductDialog, EditStoreDialog } from "./ShopDialogs";
import { More } from "./ShopPage";
import styles from "./Shop.module.css";

const TAB_IDS = ["produits", "ventes"] as const;

function CouponDialog({ store, open, onClose }: { store: string; open: boolean; onClose: () => void }) {
  return open ? <CouponForm store={store} onClose={onClose} /> : null;
}

function CouponForm({ store, onClose }: { store: string; onClose: () => void }) {
  const toast = useToast();
  const { createCoupon } = useStoreMutations(store);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [max, setMax] = useState("");
  const [ends, setEnds] = useState("");
  const amount = kind === "percent" ? Number.parseInt(value, 10) : toMinor(value, currency);
  const ready = /^[A-Z0-9_-]{3,40}$/.test(code) && Boolean(amount) && (kind === "fixed" || (amount! >= 1 && amount! <= 100));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    createCoupon.mutate(
      {
        code,
        kind,
        value: amount,
        ...(kind === "fixed" ? { currency } : {}),
        ...(max ? { max_redemptions: Number.parseInt(max, 10) } : {}),
        ...(ends ? { ends_at: new Date(`${ends}T23:59:59`).toISOString() } : {}),
      },
      {
        onSuccess: (c) => {
          toast(`Code ${c.code} créé.`, { tone: "success" });
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
      busy={createCoupon.isPending}
      title="Nouveau code promo"
      footer={
        <button type="submit" form="coupon-form" className={cx(ui.button, ui.primary)} disabled={!ready || createCoupon.isPending}>
          {createCoupon.isPending ? "Création…" : "Créer le code"}
        </button>
      }
    >
      <form id="coupon-form" className={layout.form} onSubmit={submit}>
        <Field id="cp-code" label="Code" hint="Lettres, chiffres, tirets : ex. BIENVENUE10" error={fieldError(createCoupon.error, "code")}>
          <input id="cp-code" data-autofocus className={ui.input} maxLength={40} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} />
        </Field>
        <div className={layout.chips} role="group" aria-label="Type de remise">
          <button type="button" className={ui.chip} aria-pressed={kind === "percent"} onClick={() => setKind("percent")}>
            Pourcentage
          </button>
          <button type="button" className={ui.chip} aria-pressed={kind === "fixed"} onClick={() => setKind("fixed")}>
            Montant fixe
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: kind === "fixed" ? "minmax(0, 1fr) 110px" : "minmax(0, 1fr)", gap: 8 }}>
          <Field id="cp-value" label={kind === "percent" ? "Remise (%)" : "Remise"} error={fieldError(createCoupon.error, "value")}>
            <input id="cp-value" className={ui.input} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          {kind === "fixed" && (
            <Field id="cp-currency" label="Devise">
              <select id="cp-currency" className={ui.select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <Field id="cp-max" label="Utilisations max." optional>
            <input id="cp-max" className={ui.input} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="cp-ends" label="Valable jusqu'au" optional>
            <input id="cp-ends" className={ui.input} type="date" min={new Date().toISOString().slice(0, 10)} value={ends} onChange={(e) => setEnds(e.target.value)} />
          </Field>
        </div>
        {createCoupon.isError && !fieldError(createCoupon.error, "code") && (
          <p className={ui.fieldError} role="alert">
            {describeError(createCoupon.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function Sales({ store }: { store: StoreDetail }) {
  const revenue = useRevenue(store.slug, true);
  const sales = useSales(store.slug, true);
  const list = useMemo(() => sales.data?.pages.flatMap((p) => p.results) ?? [], [sales.data]);
  const currency = list[0]?.currency ?? "XAF";
  return (
    <>
      {revenue.isPending ? (
        <Skeleton height={90} radius={18} />
      ) : revenue.isError ? (
        <ErrorState error={revenue.error} onRetry={() => revenue.refetch()} />
      ) : (
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <small>Ventes brutes</small>
            <strong>{formatMoney(revenue.data.gross_minor, currency)}</strong>
          </div>
          <div className={styles.kpi}>
            <small>Remboursé</small>
            <strong>{formatMoney(revenue.data.refunded_minor, currency)}</strong>
          </div>
          <div className={styles.kpi}>
            <small>Net pour vous</small>
            <strong>{formatMoney(revenue.data.net_minor, currency)}</strong>
          </div>
        </div>
      )}
      <p className={ui.hint} style={{ margin: 0 }}>
        Montants issus du grand livre comptable : le net est ce qui vous revient après la commission de la plateforme et les remboursements.
      </p>
      {sales.isPending ? (
        <Skeleton height={160} radius={18} />
      ) : sales.isError ? (
        <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<ReceiptIcon />} title="Aucune vente pour l'instant" text="Vos ventes apparaîtront ici dès le premier paiement." />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="bb-visually-hidden">Ventes de la boutique</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Produit</th>
                  <th scope="col">Acheteur</th>
                  <th scope="col" data-num>
                    Qté
                  </th>
                  <th scope="col" data-num>
                    Payé
                  </th>
                  <th scope="col" data-num>
                    Net
                  </th>
                  <th scope="col">État</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>{fullDate(s.paid_at)}</td>
                    <td>
                      <Link href={ROUTES.product(s.product)}>{s.title}</Link>
                      <br />
                      <small style={{ color: "var(--bb-ink-muted)" }}>{s.order_number}</small>
                    </td>
                    <td>
                      <Link href={ROUTES.profile(s.buyer.username)}>{s.buyer.display_name || s.buyer.username}</Link>
                    </td>
                    <td data-num>{s.quantity}</td>
                    <td data-num>{formatMoney(s.line_total_minor - s.discount_minor, s.currency)}</td>
                    <td data-num>{formatMoney(s.seller_net_minor, s.currency)}</td>
                    <td>
                      <Pill tone={s.refunded_minor > 0 ? "neutral" : ORDER_STATUS[s.status].tone}>{s.refunded_minor > 0 ? `Remboursé ${formatMoney(s.refunded_minor, s.currency)}` : ORDER_STATUS[s.status].label}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <More query={sales} label="Afficher plus de ventes" />
        </>
      )}
    </>
  );
}

export function StorePage({ slug }: { slug: string }) {
  const query = useStore(slug);
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [coupon, setCoupon] = useState(false);

  if (query.isPending) return <EntityHeaderSkeleton />;
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className={layout.page}>
        <Link href={ROUTES.shop} className={cx(ui.button, ui.ghost)} style={{ alignSelf: "flex-start" }}>
          <ArrowLeftIcon />
          Boutique
        </Link>
        {gone ? <EmptyState icon={<ShopIcon />} title="Boutique introuvable" /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      </div>
    );
  }
  const st = query.data;
  const mine = st.is_mine;
  const active = mine ? tab : "produits";
  const owner = st.owner.display_name || st.owner.username;

  return (
    <div className={layout.page}>
      <EntityHeader
        name={st.name}
        description={st.description || undefined}
        actions={
          mine && (
            <>
              <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setCreating(true)} disabled={st.status !== "active"}>
                <PlusIcon />
                Nouveau produit
              </button>
              <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setCoupon(true)}>
                <TagIcon />
                Code promo
              </button>
              <button type="button" className={cx(ui.button, ui.ghost)} onClick={() => setEditing(true)}>
                <PenIcon />
                Modifier
              </button>
            </>
          )
        }
        meta={
          <>
            <li>
              <Avatar name={owner} src={st.owner.avatar_url} size={24} />
              <Link href={ROUTES.profile(st.owner.username)} style={{ color: "inherit" }}>
                {owner}
              </Link>
            </li>
            <li>
              <ShopIcon aria-hidden="true" />
              {plural(st.published_count, "produit en vente", "produits en vente")}
            </li>
            <li>
              <CalendarIcon aria-hidden="true" />
              Ouverte le {fullDate(st.created_at)}
            </li>
            {st.status === "suspended" && (
              <li>
                <Pill tone="red">Suspendue</Pill>
              </li>
            )}
          </>
        }
      />
      {mine && (
        <Tabs
          idPrefix="store"
          label="Sections de la boutique"
          value={active}
          onChange={setTab}
          items={[
            { id: "produits", label: "Produits", Icon: ShopIcon, count: st.product_count },
            { id: "ventes", label: "Ventes", Icon: ReceiptIcon },
          ]}
        />
      )}
      <TabPanel idPrefix="store" id={active} className={layout.stack}>
        {active === "produits" &&
          (st.products.length === 0 ? (
            <EmptyState
              icon={<ShopIcon />}
              title={mine ? "Votre boutique est prête" : "Aucun produit en vente"}
              text={mine ? "Créez votre premier produit : template, application, ressource, service ou accès à un cours Learn." : "Revenez bientôt : cette boutique prépare ses premiers produits."}
              actions={
                mine && (
                  <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setCreating(true)}>
                    <PlusIcon />
                    Créer un produit
                  </button>
                )
              }
            />
          ) : (
            <div className={layout.grid}>
              {st.products.map((p) => (
                <ProductCard key={p.id} product={p} showStatus={mine} />
              ))}
            </div>
          ))}
        {active === "ventes" && mine && <Sales store={st} />}
      </TabPanel>
      {mine && (
        <>
          <EditStoreDialog store={st} open={editing} onClose={() => setEditing(false)} />
          <CreateProductDialog store={st.slug} open={creating} onClose={() => setCreating(false)} />
          <CouponDialog store={st.slug} open={coupon} onClose={() => setCoupon(false)} />
        </>
      )}
    </div>
  );
}
