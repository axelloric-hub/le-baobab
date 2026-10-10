import type { Metadata } from "next";
import { CommunityPage } from "@/components/pages/community/CommunityPage";
import { COMMUNITY_META } from "@/components/pages/community/community-content";
import { PageShell } from "@/components/pages/shared/PageShell";

export const metadata: Metadata = COMMUNITY_META;

export default function Page() {
  return (
    <PageShell>
      <CommunityPage />
    </PageShell>
  );
}
