/** Boutique : boutiques, produits, panier, commandes, paiements, licences, avis (apps/marketplace, apps/payments). Montants en unités mineures. */
import type { UserBrief } from "@/features/social/types";

export type ProductKind = "application" | "software" | "service" | "template" | "resource" | "course" | "digital_content";
export type ProductStatus = "draft" | "published" | "suspended" | "archived";
export type LicenseType = "personal" | "team" | "commercial" | "none";

export interface Variant {
  id: string;
  sku: string;
  name: string;
  price_minor: number;
  currency: string;
  in_stock: boolean;
  is_default: boolean;
  /** Vendeur uniquement. */
  stock?: number | null;
  is_active?: boolean;
}

export interface Product {
  id: string;
  store: { slug: string; name: string };
  kind: ProductKind;
  slug: string;
  title: string;
  excerpt: string;
  license_type: LicenseType;
  status: ProductStatus;
  rating: number | null;
  rating_count: number;
  published_at: string | null;
  variants: Variant[];
  media: Array<{ id: string; kind: string; url: string }>;
}

export interface Release {
  version: string;
  platform: string;
  changelog: string;
  requirements: string;
  installation_instructions: string;
  published_at: string;
  files: Array<{ id: string; filename: string; size_bytes: number; checksum_sha256: string }>;
}

export interface Target {
  id: string;
  scope: "classroom" | "course" | "module" | "chapter";
  target_id: string;
  label: string | null;
  course: string | null;
  classroom: string | null;
}

export interface ProductDetail extends Product {
  description: string;
  documentation_url: string;
  skills: Array<{ slug: string; name: string }>;
  owner: UserBrief;
  is_mine: boolean;
  purchased: boolean;
  in_wishlist: boolean;
  my_review: boolean;
  targets: Target[];
  latest_release: Release | null;
}

export interface Store {
  slug: string;
  name: string;
  description: string;
  status: "active" | "suspended";
  owner: UserBrief;
  created_at: string;
  is_mine: boolean;
  product_count: number;
  published_count: number;
}

export interface StoreDetail extends Store {
  products: Product[];
}

export interface Review {
  id: string;
  user: UserBrief;
  rating: number;
  title: string;
  body: string;
  created_at: string;
}

export interface CartLine {
  variant: string;
  product_id: string;
  store: { slug: string; name: string };
  kind: ProductKind;
  product: string;
  variant_name: string;
  unit_price_minor: number;
  currency: string;
  quantity: number;
  line_total_minor: number;
  available: boolean;
  in_stock: boolean;
}

export interface Cart {
  items: CartLine[];
  subtotal_minor: number;
  currency: string | null;
  count: number;
}

export type OrderStatus = "pending" | "paid" | "cancelled" | "partially_refunded" | "refunded";

export interface OrderItem {
  id: string;
  product: string;
  shop: { slug: string; name: string };
  kind: ProductKind;
  title: string;
  sku: string;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
  discount_minor: number;
  refunded_minor: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  items: OrderItem[];
  payment: { id: string; provider: string; status: string } | null;
}

export interface Payment {
  id: string;
  order: string;
  provider: string;
  amount_minor: number;
  currency: string;
  status: "initiated" | "succeeded" | "failed" | "cancelled" | "refunded";
  provider_ref?: string;
  simulation?: boolean;
}

export interface PaymentConfig {
  simulation: boolean;
  providers: Array<{ code: string; label: string; live: boolean }>;
}

export interface License {
  id: string;
  product: { id: string; title: string; kind: ProductKind };
  key: string;
  seats: number;
  status: "active" | "revoked";
  issued_at: string;
  files: Array<{ id: string; filename: string; size_bytes: number; version: string; platform: string }>;
}

export interface Refund {
  id: string;
  order_item: string;
  amount_minor: number;
  reason: string;
  status: "requested" | "processed" | "rejected";
  created_at: string;
  decided_at: string | null;
}

export interface Sale {
  id: string;
  order_number: string;
  product: string;
  title: string;
  quantity: number;
  line_total_minor: number;
  discount_minor: number;
  seller_net_minor: number;
  refunded_minor: number;
  currency: string;
  status: OrderStatus;
  paid_at: string;
  buyer: UserBrief;
}

export interface ProductInput {
  kind?: ProductKind;
  slug?: string;
  title?: string;
  description?: string;
  license_type?: LicenseType;
  documentation_url?: string;
  skills?: string[];
  status?: "draft" | "archived";
}

export interface ProductFilters {
  q?: string;
  kind?: string;
  store?: string;
  skill?: string;
  target?: string;
  course?: string;
}
