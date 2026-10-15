import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyPage } from "@/components/member/jobs/CompanyPage";

interface Props {
  params: Promise<{ slug: string }>;
}

const SLUG = /^[a-z0-9_-]{1,80}$/i;

export const metadata: Metadata = { title: "Entreprise" };

export default async function Page({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  if (!SLUG.test(slug)) notFound();
  return <CompanyPage key={slug} slug={slug} />;
}
