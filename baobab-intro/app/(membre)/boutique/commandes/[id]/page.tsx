import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderPage } from "@/components/member/shop/OrderPage";

interface Props {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Commande" };

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <OrderPage key={id} id={id} />;
}
