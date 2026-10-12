import type { Metadata } from "next";
import { HashtagFeed } from "@/components/member/feed/TopicFeeds";

interface Props {
  params: Promise<{ tag: string }>;
}

const clean = (raw: string) => decodeURIComponent(raw).replace(/^#/, "").toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `#${clean((await params).tag)}` };
}

export default async function Page({ params }: Props) {
  return <HashtagFeed tag={clean((await params).tag)} />;
}
