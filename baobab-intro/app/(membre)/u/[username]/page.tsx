import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfilePage } from "@/components/member/profile/ProfilePage";

interface Props {
  params: Promise<{ username: string }>;
}

/** Pseudo valide côté backend : 3 à 30 caractères, a-z 0-9 _ . */
const USERNAME = /^[a-z0-9][a-z0-9_.]{2,29}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `@${decodeURIComponent((await params).username).toLowerCase()}` };
}

export default async function Page({ params }: Props) {
  const username = decodeURIComponent((await params).username).toLowerCase();
  if (!USERNAME.test(username)) notFound();
  return <ProfilePage key={username} username={username} />;
}
