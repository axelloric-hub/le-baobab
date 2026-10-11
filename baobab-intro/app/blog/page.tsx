import type { Metadata } from "next";
import { BlogPage } from "@/components/pages/blog/BlogPage";
import { BLOG_META } from "@/components/pages/blog/blog-content";
import { PageShell } from "@/components/pages/shared/PageShell";

export const metadata: Metadata = BLOG_META;

export default function Page() {
  return (
    <PageShell>
      <BlogPage />
    </PageShell>
  );
}
