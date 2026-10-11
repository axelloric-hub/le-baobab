import type { Metadata } from "next";
import { REGISTER } from "@/components/auth/auth-content";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = REGISTER.meta;

export default function Page() {
  return (
    <AuthShell panelTitle={REGISTER.panelTitle}>
      <RegisterForm />
    </AuthShell>
  );
}
