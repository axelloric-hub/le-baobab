"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import { useDebounced } from "@/features/people/hooks";
import { shopApi } from "./api";
import type { Cart, Order, Product, ProductFilters, ProductInput, Review, Sale } from "./types";

export const shopKeys = {
  products: (filters: ProductFilters) => ["shop", "products", filters] as const,
  product: (id: string) => ["shop", "product", id] as const,
  reviews: (id: string) => ["shop", "product", id, "reviews"] as const,
  wishlist: ["shop", "wishlist"] as const,
  cart: ["shop", "cart"] as const,
  orders: ["shop", "orders"] as const,
  order: (id: string) => ["shop", "order", id] as const,
  paymentConfig: ["shop", "payment-config"] as const,
  licenses: ["shop", "licenses"] as const,
  refunds: ["shop", "refunds"] as const,
  myStores: ["shop", "stores", "mine"] as const,
  store: (slug: string) => ["shop", "store", slug] as const,
  revenue: (slug: string) => ["shop", "store", slug, "revenue"] as const,
  sales: (slug: string) => ["shop", "store", slug, "sales"] as const,
};

function paged<T>(key: readonly unknown[], first: () => Promise<Page<T>>, next: (path: string) => Promise<Page<T>>, enabled = true) {
  return {
    queryKey: key,
    queryFn: ({ pageParam }: { pageParam: string | null }) => (pageParam ? next(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<T>) => nextPath(last.next),
    enabled,
    staleTime: 30_000,
  };
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export function useProducts(filters: ProductFilters, enabled = true) {
  const q = useDebounced(filters.q?.trim() ?? "");
  const effective = { ...filters, q: q.length >= 2 ? q : "" };
  return useInfiniteQuery(paged<Product>(shopKeys.products(effective), () => shopApi.products(effective), (path) => shopApi.products({}, path), enabled));
}

export const useProduct = (id: string) => useQuery({ queryKey: shopKeys.product(id), queryFn: () => shopApi.product(id), staleTime: 30_000 });
export const useReviews = (id: string) => useInfiniteQuery(paged<Review>(shopKeys.reviews(id), () => shopApi.reviews(id), (path) => shopApi.reviews(id, path)));
export const useWishlist = () => useQuery({ queryKey: shopKeys.wishlist, queryFn: shopApi.wishlist, staleTime: 30_000 });
export const useCart = (enabled = true) => useQuery({ queryKey: shopKeys.cart, queryFn: shopApi.cart, staleTime: 15_000, enabled });
export const useOrders = () => useInfiniteQuery(paged<Order>(shopKeys.orders, () => shopApi.orders(), (path) => shopApi.orders(path)));
export const useOrder = (id: string) => useQuery({ queryKey: shopKeys.order(id), queryFn: () => shopApi.order(id), staleTime: 10_000 });
export const usePaymentConfig = () => useQuery({ queryKey: shopKeys.paymentConfig, queryFn: shopApi.paymentConfig, staleTime: 10 * 60_000 });
export const useLicenses = () => useQuery({ queryKey: shopKeys.licenses, queryFn: shopApi.licenses, staleTime: 60_000 });
export const useRefunds = (enabled = true) => useQuery({ queryKey: shopKeys.refunds, queryFn: () => shopApi.refunds().then((p) => p.results), staleTime: 30_000, enabled });
export const useMyStores = () => useQuery({ queryKey: shopKeys.myStores, queryFn: shopApi.myStores, staleTime: 60_000 });
export const useStore = (slug: string) => useQuery({ queryKey: shopKeys.store(slug), queryFn: () => shopApi.store(slug), staleTime: 30_000 });
export const useRevenue = (slug: string, enabled: boolean) => useQuery({ queryKey: shopKeys.revenue(slug), queryFn: () => shopApi.revenue(slug), enabled, staleTime: 60_000 });
export const useSales = (slug: string, enabled: boolean) => useInfiniteQuery(paged<Sale>(shopKeys.sales(slug), () => shopApi.sales(slug), (path) => shopApi.sales(slug, path), enabled));

/* ------------------------------------------------------------------ */
/* Acheteur                                                            */
/* ------------------------------------------------------------------ */

const setCart = (client: QueryClient) => (cart: Cart) => client.setQueryData(shopKeys.cart, cart);

export function useCartMutations() {
  const client = useQueryClient();
  return {
    add: useMutation({ mutationFn: ({ variant, quantity }: { variant: string; quantity?: number }) => shopApi.addToCart(variant, quantity), onSuccess: setCart(client) }),
    set: useMutation({ mutationFn: ({ variant, quantity }: { variant: string; quantity: number }) => shopApi.setQuantity(variant, quantity), onSuccess: setCart(client) }),
    remove: useMutation({ mutationFn: (variant: string) => shopApi.removeLine(variant), onSuccess: setCart(client) }),
    checkout: useMutation({
      mutationFn: ({ key, coupon }: { key: string; coupon: string }) => shopApi.checkout(key, coupon),
      onSuccess: (order) => {
        client.setQueryData(shopKeys.order(order.id), order);
        client.setQueryData<Cart>(shopKeys.cart, { items: [], subtotal_minor: 0, currency: null, count: 0 });
        void client.invalidateQueries({ queryKey: shopKeys.orders });
      },
    }),
  };
}

export function useWishlistToggle(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => shopApi.toggleWishlist(id),
    onSuccess: ({ in_wishlist }) => {
      client.setQueryData(shopKeys.product(id), (p: object | undefined) => (p ? { ...p, in_wishlist } : p));
      void client.invalidateQueries({ queryKey: shopKeys.wishlist });
    },
  });
}

export function useReviewMutation(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; title: string; body: string }) => shopApi.review(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: shopKeys.product(id) });
      void client.invalidateQueries({ queryKey: shopKeys.reviews(id) });
    },
  });
}

/** Paiement d'une commande : la commande, les licences, mes cours (accès débloqués) et le menu latéral sont rafraîchis. */
export function useOrderPayment(id: string) {
  const client = useQueryClient();
  const settle = (order: Order) => {
    client.setQueryData(shopKeys.order(id), order);
    void client.invalidateQueries({ queryKey: shopKeys.orders });
    if (order.status === "paid") {
      void client.invalidateQueries({ queryKey: shopKeys.licenses });
      void client.invalidateQueries({ queryKey: ["shop", "product"] });
      void client.invalidateQueries({ queryKey: ["me"] });
      void client.invalidateQueries({ queryKey: ["chapter"] });
      void client.invalidateQueries({ queryKey: ["course"] });
      void client.invalidateQueries({ queryKey: ["classroom"] });
    }
  };
  return {
    payFree: useMutation({ mutationFn: () => shopApi.payFree(id), onSuccess: settle }),
    start: useMutation({ mutationFn: (provider: string) => shopApi.startPayment(id, provider), onSuccess: () => void client.invalidateQueries({ queryKey: shopKeys.order(id) }) }),
    simulate: useMutation({ mutationFn: ({ payment, outcome }: { payment: string; outcome: "succeeded" | "failed" }) => shopApi.simulate(payment, outcome), onSuccess: (r) => settle(r.order) }),
    cancel: useMutation({ mutationFn: () => shopApi.cancelOrder(id), onSuccess: settle }),
    refund: useMutation({
      mutationFn: ({ item, reason }: { item: string; reason: string }) => shopApi.requestRefund(item, reason),
      onSuccess: () => void client.invalidateQueries({ queryKey: shopKeys.refunds }),
    }),
  };
}

export function useDownload() {
  return useMutation({ mutationFn: (asset: string) => shopApi.download(asset) });
}

/* ------------------------------------------------------------------ */
/* Vendeur                                                             */
/* ------------------------------------------------------------------ */

export function useStoreMutations(slug: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: shopKeys.store(slug) });
    void client.invalidateQueries({ queryKey: shopKeys.myStores });
  };
  return {
    update: useMutation({ mutationFn: (input: { name?: string; description?: string }) => shopApi.updateStore(slug, input), onSuccess: refresh }),
    createProduct: useMutation({ mutationFn: (input: ProductInput) => shopApi.createProduct(slug, input), onSuccess: refresh }),
    createCoupon: useMutation({ mutationFn: (input: Record<string, unknown>) => shopApi.createCoupon(slug, input) }),
  };
}

export function useCreateStore() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string; description: string }) => shopApi.createStore(input),
    onSuccess: () => void client.invalidateQueries({ queryKey: shopKeys.myStores }),
  });
}

export function useProductMutations(id: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: shopKeys.product(id) });
    void client.invalidateQueries({ queryKey: ["shop", "store"] });
    void client.invalidateQueries({ queryKey: ["shop", "products"] });
  };
  return {
    update: useMutation({ mutationFn: (input: ProductInput) => shopApi.updateProduct(id, input), onSuccess: refresh }),
    publish: useMutation({ mutationFn: () => shopApi.publish(id), onSuccess: refresh }),
    addVariant: useMutation({ mutationFn: (input: { sku: string; name: string; price_minor: number; currency: string; stock: number | null }) => shopApi.addVariant(id, input), onSuccess: refresh }),
    updateVariant: useMutation({
      mutationFn: ({ variant, ...input }: { variant: string; name?: string; price_minor?: number; stock?: number | null; is_active?: boolean }) => shopApi.updateVariant(id, variant, input),
      onSuccess: refresh,
    }),
    addMedia: useMutation({ mutationFn: (file: string) => shopApi.addMedia(id, file), onSuccess: refresh }),
    removeMedia: useMutation({ mutationFn: (media: string) => shopApi.removeMedia(id, media), onSuccess: refresh }),
    addRelease: useMutation({ mutationFn: (input: Record<string, unknown>) => shopApi.addRelease(id, input), onSuccess: refresh }),
    addTarget: useMutation({ mutationFn: ({ scope, target }: { scope: string; target: string }) => shopApi.addTarget(id, scope, target), onSuccess: refresh }),
    removeTarget: useMutation({ mutationFn: (target: string) => shopApi.removeTarget(id, target), onSuccess: refresh }),
  };
}
