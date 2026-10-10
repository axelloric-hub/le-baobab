import type { Metadata } from "next";
import { DocsHome } from "@/components/pages/docs/DocsHome";
import { DOCS_META } from "@/components/pages/docs/docs-content";
import { PageShell } from "@/components/pages/shared/PageShell";

export const metadata: Metadata = DOCS_META;

export default function Page() {
  return (
    <PageShell>
      <DocsHome />
    </PageShell>
  );
}
