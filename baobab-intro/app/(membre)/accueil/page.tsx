import type { Metadata } from "next";
import { HomeFeed } from "@/components/member/feed/HomeFeed";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  return <HomeFeed />;
}
