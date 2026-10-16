import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPage } from "@/components/member/learn/LessonPage";

interface Props {
  params: Promise<{ id: string; chapter: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Chapitre" };

export default async function Page({ params }: Props) {
  const { id, chapter } = await params;
  if (!UUID.test(id) || !UUID.test(chapter)) notFound();
  return <LessonPage key={chapter} courseId={id} chapterId={chapter} />;
}
