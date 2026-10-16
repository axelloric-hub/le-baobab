import type { Metadata } from "next";
import { StorePage } from "@/components/member/shop/StorePage";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Boutique" };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <StorePage key={slug} slug={decodeURIComponent(slug)} />;
}
