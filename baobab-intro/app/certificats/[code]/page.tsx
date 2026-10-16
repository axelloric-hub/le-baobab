import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CertificateCheck } from "@/components/pages/certificate/CertificateCheck";
import { PageShell } from "@/components/pages/shared/PageShell";

interface Props {
  params: Promise<{ code: string }>;
}

const CODE = /^[A-Za-z0-9-]{4,40}$/;

export const metadata: Metadata = {
  title: "Vérifier un certificat — LE BAOBAB",
  description: "Vérifiez l'authenticité d'un certificat délivré par LE BAOBAB.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: Props) {
  const code = decodeURIComponent((await params).code);
  if (!CODE.test(code)) notFound();
  return (
    <PageShell>
      <CertificateCheck code={code} />
    </PageShell>
  );
}
