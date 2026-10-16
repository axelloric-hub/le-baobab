"use client";

import Link from "next/link";
import { useProducts } from "@/features/shop/hooks";
import { ROUTES } from "@/lib/routes";
import { cx } from "../ui/cx";
import { ShopIcon } from "../ui/icons";
import ui from "../ui/ui.module.css";
import { priceOf } from "./labels";

/**
 * Accès payant à un contenu Learn : liens vers les produits de la Boutique qui le débloquent (données réelles).
 * Rien n'est affiché si aucun produit n'est en vente.
 */
export function BuyAccess({ course, target, primary, block = true }: { course?: string; target?: string; primary?: boolean; block?: boolean }) {
  const products = useProducts(course ? { course } : { target }, Boolean(course || target));
  const list = products.data?.pages.flatMap((p) => p.results) ?? [];
  if (list.length === 0) return null;
  return (
    <>
      {list.slice(0, 3).map((p) => {
        const price = priceOf(p);
        return (
          <Link key={p.id} href={ROUTES.product(p.id)} className={cx(ui.button, primary ? ui.primary : ui.secondary, block && ui.block)}>
            <ShopIcon />
            {list.length === 1 ? "Acheter l'accès" : p.title}
            {price && !price.free ? ` · ${price.text}` : ""}
          </Link>
        );
      })}
    </>
  );
}
