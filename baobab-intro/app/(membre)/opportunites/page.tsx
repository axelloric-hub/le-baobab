import type { Metadata } from "next";
import { JobsPage } from "@/components/member/jobs/JobsPage";

export const metadata: Metadata = { title: "Opportunités" };

export default function Page() {
  return <JobsPage />;
}
