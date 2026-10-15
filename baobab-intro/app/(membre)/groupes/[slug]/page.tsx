import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GroupPage } from "@/components/member/community/GroupPage";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Adresse d'un groupe : slug du backend (lettres, chiffres, tirets, soulignés ; 80 caractères au plus). */
const SLUG = /^[a-z0-9_-]{1,80}$/i;

export const metadata: Metadata = { title: "Groupe" };

export default async function Page({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  if (!SLUG.test(slug)) notFound();
  return <GroupPage key={slug} slug={slug} />;
}
