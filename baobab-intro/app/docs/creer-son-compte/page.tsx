import type { Metadata } from "next";
import { DocsAccount } from "@/components/pages/docs/DocsAccount";
import { DOCS_ACCOUNT } from "@/components/pages/docs/docs-content";
import { PageShell } from "@/components/pages/shared/PageShell";

export const metadata: Metadata = DOCS_ACCOUNT.meta;

export default function Page() {
  return (
    <PageShell>
      <DocsAccount />
    </PageShell>
  );
}
