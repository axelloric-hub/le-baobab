/** Couche service Boutique : une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type {
  Cart,
  License,
  Order,
  Payment,
  PaymentConfig,
  Product,
  ProductDetail,
  ProductFilters,
  ProductInput,
  Refund,
  Review,
  Sale,
  Store,
  StoreDetail,
  Variant,
} from "./types";

const p = (id: string) => `/products/${id}`;
const st = (slug: string) => `/stores/${encodeURIComponent(slug)}`;

export const shopApi = {
  products: (filters: ProductFilters, path?: string) => {
    if (path) return authed<Page<Product>>(path);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return authed<Page<Product>>(`/products/?${query}`);
  },
  product: (id: string) => authed<ProductDetail>(`${p(id)}/`),
  reviews: (id: string, path?: string) => authed<Page<Review>>(path ?? `${p(id)}/reviews/`),
  review: (id: string, input: { rating: number; title: string; body: string }) => authed<{ id: string }>(`${p(id)}/reviews/`, { method: "POST", body: input }),
  toggleWishlist: (id: string) => authed<{ in_wishlist: boolean }>(`${p(id)}/wishlist/`, { method: "POST", body: {} }),
  wishlist: () => authed<Product[]>("/me/wishlist/"),

  cart: () => authed<Cart>("/cart/"),
  addToCart: (variant: string, quantity = 1) => authed<Cart>("/cart/items/", { method: "POST", body: { variant, quantity } }),
  setQuantity: (variant: string, quantity: number) => authed<Cart>(`/cart/items/${variant}/`, { method: "PATCH", body: { quantity } }),
  removeLine: (variant: string) => authed<Cart>(`/cart/items/${variant}/`, { method: "DELETE" }),
  checkout: (idempotency_key: string, coupon_code: string) => authed<Order>("/checkout/", { method: "POST", body: { idempotency_key, coupon_code } }),

  orders: (path?: string) => authed<Page<Order>>(path ?? "/orders/"),
  order: (id: string) => authed<Order>(`/orders/${id}/`),
  cancelOrder: (id: string) => authed<Order>(`/orders/${id}/cancel/`, { method: "POST", body: {} }),
  payFree: (id: string) => authed<Order>(`/orders/${id}/pay-free/`, { method: "POST", body: {} }),
  paymentConfig: () => authed<PaymentConfig>("/payments/config/"),
  startPayment: (order: string, provider: string) => authed<Payment>("/payments/start/", { method: "POST", body: { order, provider } }),
  simulate: (payment: string, outcome: "succeeded" | "failed") => authed<{ payment: Payment; order: Order }>(`/payments/${payment}/simulate/`, { method: "POST", body: { outcome } }),
  requestRefund: (order_item: string, reason: string) => authed<Refund>("/refunds/", { method: "POST", body: { order_item, reason } }),
  refunds: () => authed<Page<Refund>>("/me/refunds/?limit=100"),
  licenses: () => authed<License[]>("/me/licenses/"),
  download: (asset: string) => authed<{ url: string; expires_in: number }>(`/assets/${asset}/download/`, { method: "POST", body: {} }),

  myStores: () => authed<Store[]>("/me/stores/"),
  store: (slug: string) => authed<StoreDetail>(`${st(slug)}/`),
  createStore: (input: { name: string; slug: string; description: string }) => authed<{ slug: string; name: string }>("/stores/", { method: "POST", body: input }),
  updateStore: (slug: string, input: { name?: string; description?: string }) => authed<Store>(`${st(slug)}/`, { method: "PATCH", body: input }),
  revenue: (slug: string) => authed<{ gross_minor: number; refunded_minor: number; net_minor: number }>(`${st(slug)}/revenue/`),
  sales: (slug: string, path?: string) => authed<Page<Sale>>(path ?? `${st(slug)}/sales/`),
  createCoupon: (slug: string, input: Record<string, unknown>) => authed<{ id: string; code: string }>(`${st(slug)}/coupons/`, { method: "POST", body: input }),

  createProduct: (slug: string, input: ProductInput) => authed<{ id: string; status: string }>(`${st(slug)}/products/`, { method: "POST", body: input }),
  updateProduct: (id: string, input: ProductInput) => authed<ProductDetail>(`${p(id)}/`, { method: "PATCH", body: input }),
  publish: (id: string) => authed<{ id: string; status: string }>(`${p(id)}/publish/`, { method: "POST", body: {} }),
  addVariant: (id: string, input: { sku: string; name: string; price_minor: number; currency: string; stock: number | null }) =>
    authed<Variant>(`${p(id)}/variants/`, { method: "POST", body: input }),
  updateVariant: (id: string, variant: string, input: Partial<{ name: string; price_minor: number; stock: number | null; is_active: boolean }>) =>
    authed<Variant>(`${p(id)}/variants/${variant}/`, { method: "PATCH", body: input }),
  addMedia: (id: string, file: string) => authed<{ added: boolean }>(`${p(id)}/media/`, { method: "POST", body: { file } }),
  removeMedia: (id: string, media: string) => authed<void>(`${p(id)}/media/${media}/`, { method: "DELETE" }),
  addRelease: (id: string, input: Record<string, unknown>) => authed<{ id: string; version: string }>(`${p(id)}/releases/`, { method: "POST", body: input }),
  addTarget: (id: string, scope: string, target_id: string) => authed<{ added: boolean }>(`${p(id)}/entitlement-targets/`, { method: "POST", body: { scope, target_id } }),
  removeTarget: (id: string, target: string) => authed<void>(`${p(id)}/entitlement-targets/${target}/`, { method: "DELETE" }),
};
