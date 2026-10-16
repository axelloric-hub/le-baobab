import type { Metadata } from "next";
import { LearnPage } from "@/components/member/learn/LearnPage";

export const metadata: Metadata = { title: "Learn" };

export default function Page() {
  return <LearnPage />;
}
