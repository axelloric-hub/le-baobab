import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/member/shop/ProductPage";

interface Props {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Produit" };

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <ProductPage key={id} id={id} />;
}
