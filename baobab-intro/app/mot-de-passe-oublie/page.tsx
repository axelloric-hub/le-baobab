import type { Metadata } from "next";
import { FORGOT } from "@/components/auth/auth-content";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = FORGOT.meta;

export default function Page() {
  return (
    <AuthShell panelTitle={FORGOT.panelTitle}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
