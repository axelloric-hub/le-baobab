import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManageJobPage } from "@/components/member/jobs/ManageJobPage";

interface Props {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Candidatures" };

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <ManageJobPage key={id} id={id} />;
}
