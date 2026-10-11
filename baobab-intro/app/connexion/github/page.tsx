import type { Metadata } from "next";
import { GITHUB_CALLBACK } from "@/components/auth/auth-content";
import { AuthShell } from "@/components/auth/AuthShell";
import { GitHubCallback } from "@/components/auth/GitHubCallback";

export const metadata: Metadata = { ...GITHUB_CALLBACK.meta, robots: { index: false } };

export default function Page() {
  return (
    <AuthShell panelTitle={GITHUB_CALLBACK.panelTitle}>
      <GitHubCallback />
    </AuthShell>
  );
}
