import type { Metadata } from "next";
import { ArticlePage } from "@/components/pages/blog/ArticlePage";
import { ARTICLE_IDEMPOTENCE } from "@/components/pages/blog/article-idempotence";
import { PageShell } from "@/components/pages/shared/PageShell";

export const metadata: Metadata = {
  title: `${ARTICLE_IDEMPOTENCE.breadcrumb} — Blog LE BAOBAB`,
  description: ARTICLE_IDEMPOTENCE.description,
};

export default function Page() {
  return (
    <PageShell>
      <ArticlePage />
    </PageShell>
  );
}
