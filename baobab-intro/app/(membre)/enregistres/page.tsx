import type { Metadata } from "next";
import { SavedFeed } from "@/components/member/feed/TopicFeeds";

export const metadata: Metadata = { title: "Enregistrés" };

export default function Page() {
  return <SavedFeed />;
}
