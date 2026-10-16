"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart, useDownload, useLicenses, useMyStores, useOrders, useProducts, useWishlist } from "@/features/shop/hooks";
import type { ProductKind } from "@/features/shop/types";
import { describeError } from "@/lib/api/errors";
import { relativeTime, plural } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { CartIcon, CopyIcon, DownloadIcon, HeartIcon, KeyIcon, PlusIcon, ReceiptIcon, SearchIcon, ShopIcon, SparklesIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { fileSize, KIND_LABELS, ORDER_STATUS, PLATFORMS } from "./labels";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { CreateStoreDialog } from "./ShopDialogs";
import styles from "./Shop.module.css";

const TAB_IDS = ["catalogue", "souhaits", "achats", "vendre"] as const;

function LoadingGrid() {
  return (
    <div className={layout.grid}>
      {[0, 1, 2, 3].map((i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

type Paged = { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };

export function More({ query, label }: { query: Paged; label: string }) {
  if (!query.hasNextPage) return null;
  return (
    <div className={layout.more}>
      {query.isFetchingNextPage ? (
        <Spinner label="Chargement de la suite" />
      ) : (
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => query.fetchNextPage()}>
          {label}
        </button>
      )}
    </div>
  );
}

function CatalogTab() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const products = useProducts({ q, kind });
  const list = useMemo(() => products.data?.pages.flatMap((p) => p.results) ?? [], [products.data]);
  const filtered = Boolean(q.trim() || kind);
  return (
    <>
      <div className={layout.toolbar}>
        <div className={layout.searchBox}>
          <SearchIcon />
          <input className={ui.input} type="search" placeholder="Rechercher : template, API, formation, audit…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un produit" />
        </div>
      </div>
      <div className={layout.chips} role="group" aria-label="Type de produit">
        <button type="button" className={ui.chip} aria-pressed={!kind} onClick={() => setKind("")}>
          Tout
        </button>
        {(Object.keys(KIND_LABELS) as ProductKind[]).map((k) => (
          <button key={k} type="button" className={ui.chip} aria-pressed={kind === k} onClick={() => setKind(kind === k ? "" : k)}>
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
      {products.isPending ? (
        <LoadingGrid />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ShopIcon />}
          title={filtered ? "Aucun produit ne correspond" : "La Boutique ouvre ses rayons"}
          text={filtered ? "Essayez un autre mot ou un autre type." : "Aucun produit n'est encore en vente. Ouvrez votre boutique pour vendre vos templates, applications, services ou formations."}
        />
      ) : (
        <>
          <div className={layout.grid}>
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <More query={products} label="Afficher plus de produits" />
        </>
      )}
    </>
  );
}

function WishlistTab({ goCatalog }: { goCatalog: () => void }) {
  const wishlist = useWishlist();
  if (wishlist.isPending) return <LoadingGrid />;
  if (wishlist.isError) return <ErrorState error={wishlist.error} onRetry={() => wishlist.refetch()} />;
  if (wishlist.data.length === 0) {
    return (
      <EmptyState
        icon={<HeartIcon />}
        title="Votre liste de souhaits est vide"
        text="Ajoutez-y les produits qui vous intéressent depuis leur fiche, pour les retrouver ici."
        actions={
          <button type="button" className={cx(ui.button, ui.primary)} onClick={goCatalog}>
            <SparklesIcon />
            Parcourir le catalogue
          </button>
        }
      />
    );
  }
  return (
    <div className={layout.grid}>
      {wishlist.data.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function Licenses() {
  const toast = useToast();
  const licenses = useLicenses();
  const download = useDownload();
  if (licenses.isPending) return <Skeleton height={100} radius={18} />;
  if (licenses.isError) return <ErrorState error={licenses.error} onRetry={() => licenses.refetch()} />;
  if (licenses.data.length === 0) return null;
  const copy = (key: string) =>
    navigator.clipboard?.writeText(key).then(
      () => toast("Clé copiée.", { tone: "success" }),
      () => toast("Copie impossible : sélectionnez la clé à la main.", { tone: "error" }),
    );
  return (
    <section aria-labelledby="mes-licences" className={layout.stack}>
      <h2 id="mes-licences" className={layout.sectionTitle}>
        Licences et téléchargements
      </h2>
      {licenses.data.map((l) => (
        <article key={l.id} className={layout.panelCard}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <KeyIcon aria-hidden="true" width={20} height={20} style={{ color: "var(--bb-brown-700)" }} />
            <Link href={ROUTES.product(l.product.id)} style={{ fontWeight: 750, color: "var(--bb-brown-950)", flex: "1 1 200px" }}>
              {l.product.title}
            </Link>
            <Pill tone={l.status === "active" ? "green" : "neutral"}>{l.status === "active" ? "Active" : "Révoquée"}</Pill>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span className={styles.licenseKey}>{l.key}</span>
            <button type="button" className={cx(ui.button, ui.ghost, ui.small)} onClick={() => copy(l.key)}>
              <CopyIcon />
              Copier la clé
            </button>
            <span className={ui.hint} style={{ margin: 0 }}>
              {plural(l.seats, "poste", "postes")} · délivrée {relativeTime(l.issued_at)}
            </span>
          </div>
          {l.files.length > 0 && (
            <div className={layout.stack} style={{ gap: 8, marginTop: 12 }}>
              {l.files.map((f) => (
                <div key={f.id} className={styles.fileRow}>
                  <span>
                    <strong>{f.filename}</strong>
                    <small>
                      Version {f.version} · {PLATFORMS[f.platform] ?? f.platform} · {fileSize(f.size_bytes)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className={cx(ui.button, ui.secondary, ui.small)}
                    disabled={download.isPending}
                    onClick={() =>
                      download.mutate(f.id, {
                        onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
                        onError: (e) => toast(describeError(e), { tone: "error" }),
                      })
                    }
                  >
                    <DownloadIcon />
                    Télécharger
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function PurchasesTab({ goCatalog }: { goCatalog: () => void }) {
  const orders = useOrders();
  const list = useMemo(() => orders.data?.pages.flatMap((p) => p.results) ?? [], [orders.data]);
  if (orders.isPending) return <Skeleton height={160} radius={18} />;
  if (orders.isError) return <ErrorState error={orders.error} onRetry={() => orders.refetch()} />;
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptIcon />}
        title="Aucune commande pour l'instant"
        text="Vos commandes, vos licences et vos fichiers à télécharger apparaîtront ici après votre premier achat."
        actions={
          <button type="button" className={cx(ui.button, ui.primary)} onClick={goCatalog}>
            <SparklesIcon />
            Parcourir le catalogue
          </button>
        }
      />
    );
  }
  return (
    <>
      <Licenses />
      <section aria-labelledby="mes-commandes" className={layout.stack}>
        <h2 id="mes-commandes" className={layout.sectionTitle}>
          Commandes
        </h2>
        <ul className={styles.lines}>
          {list.map((o) => {
            const status = ORDER_STATUS[o.status];
            return (
              <li key={o.id} className={styles.line} style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                <div className={styles.lineMain}>
                  <span className={styles.lineText}>
                    <Link href={ROUTES.order(o.id)}>Commande {o.number}</Link>
                    <small>
                      {o.items.map((i) => i.title).join(", ")} · {relativeTime(o.created_at)}
                    </small>
                  </span>
                  <span className={styles.lineEnd}>
                    <Pill tone={status.tone}>{status.label}</Pill>
                    <span className={styles.lineTotal}>{formatMoney(o.total_minor, o.currency)}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <More query={orders} label="Afficher plus de commandes" />
      </section>
    </>
  );
}

function SellTab({ onCreate }: { onCreate: () => void }) {
  const stores = useMyStores();
  if (stores.isPending) return <Skeleton height={120} radius={18} />;
  if (stores.isError) return <ErrorState error={stores.error} onRetry={() => stores.refetch()} />;
  if (stores.data.length === 0) {
    return (
      <EmptyState
        icon={<ShopIcon />}
        title="Vendez votre savoir-faire"
        text="Ouvrez votre boutique pour vendre des templates, des applications, des ressources, des services ou l'accès à vos cours Learn. Paiement, licences et téléchargements sont gérés pour vous."
        actions={
          <button type="button" className={cx(ui.button, ui.primary)} onClick={onCreate}>
            <PlusIcon />
            Ouvrir ma boutique
          </button>
        }
      />
    );
  }
  return (
    <>
      <div className={layout.pageHeader} style={{ alignItems: "center" }}>
        <h2 className={layout.sectionTitle} style={{ margin: 0 }}>
          Mes boutiques
        </h2>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={onCreate}>
          <PlusIcon />
          Ouvrir une autre boutique
        </button>
      </div>
      <ul className={layout.people}>
        {stores.data.map((s) => (
          <li key={s.slug}>
            <Link href={ROUTES.store(s.slug)} className={layout.person} style={{ textDecoration: "none" }}>
              <Avatar name={s.name} size={44} />
              <span className={layout.personText}>
                <span className={layout.personName}>{s.name}</span>
                <span className={layout.personMeta}>
                  {plural(s.published_count, "produit en vente", "produits en vente")} · {plural(s.product_count, "produit au total", "produits au total")}
                </span>
              </span>
              <span className={layout.personActions}>{s.status === "suspended" ? <Pill tone="red">Suspendue</Pill> : <Pill tone="green">Active</Pill>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CartButton() {
  const cart = useCart();
  const count = cart.data?.count ?? 0;
  return (
    <Link href={ROUTES.cart} className={cx(ui.button, ui.secondary)} aria-label={count ? `Panier, ${plural(count, "article", "articles")}` : "Panier"}>
      <CartIcon />
      Panier
      {count > 0 && (
        <span aria-hidden="true" style={{ minWidth: 22, padding: "1px 7px", borderRadius: 999, background: "var(--bb-brown-800)", color: "#fff", fontSize: 12.5, fontWeight: 800 }}>
          {count}
        </span>
      )}
    </Link>
  );
}

export function ShopPage() {
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [creating, setCreating] = useState(false);
  return (
    <div className={layout.page}>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <ShopIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Boutique</h1>
            <p className={layout.pageLead}>Templates, applications, ressources, services et formations, vendus par les développeurs de la communauté.</p>
          </div>
        </div>
        <CartButton />
      </header>
      <Tabs
        idPrefix="boutique"
        label="Boutique"
        value={tab}
        onChange={setTab}
        items={[
          { id: "catalogue", label: "Catalogue", Icon: SparklesIcon },
          { id: "souhaits", label: "Souhaits", Icon: HeartIcon },
          { id: "achats", label: "Mes achats", Icon: ReceiptIcon },
          { id: "vendre", label: "Vendre", Icon: ShopIcon },
        ]}
      />
      <TabPanel idPrefix="boutique" id={tab} className={layout.stack}>
        {tab === "catalogue" && <CatalogTab />}
        {tab === "souhaits" && <WishlistTab goCatalog={() => setTab("catalogue")} />}
        {tab === "achats" && <PurchasesTab goCatalog={() => setTab("catalogue")} />}
        {tab === "vendre" && <SellTab onCreate={() => setCreating(true)} />}
      </TabPanel>
      <CreateStoreDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
