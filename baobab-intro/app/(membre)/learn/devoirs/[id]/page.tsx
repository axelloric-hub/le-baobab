import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssignmentPage } from "@/components/member/learn/AssignmentPage";

interface Props {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Devoir" };

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <AssignmentPage key={id} id={id} />;
}
