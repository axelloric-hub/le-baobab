import type { Metadata } from "next";
import { ShopPage } from "@/components/member/shop/ShopPage";

export const metadata: Metadata = { title: "Boutique" };

export default function Page() {
  return <ShopPage />;
}
