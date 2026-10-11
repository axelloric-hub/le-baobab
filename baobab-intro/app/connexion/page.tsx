import type { Metadata } from "next";
import { LOGIN } from "@/components/auth/auth-content";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = LOGIN.meta;

export default function Page() {
  return (
    <AuthShell panelTitle={LOGIN.panelTitle}>
      <LoginForm />
    </AuthShell>
  );
}
