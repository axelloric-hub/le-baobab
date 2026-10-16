import type { Metadata } from "next";
import { CartPage } from "@/components/member/shop/CartPage";

export const metadata: Metadata = { title: "Panier" };

export default function Page() {
  return <CartPage />;
}
