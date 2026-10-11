import type { Metadata } from "next";
import { VERIFY } from "@/components/auth/auth-content";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export const metadata: Metadata = { ...VERIFY.meta, robots: { index: false } };

export default function Page() {
  return (
    <AuthShell panelTitle={VERIFY.panelTitle}>
      <VerifyEmailForm />
    </AuthShell>
  );
}
