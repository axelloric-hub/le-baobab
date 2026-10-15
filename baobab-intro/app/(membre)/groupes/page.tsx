import type { Metadata } from "next";
import { GroupsPage } from "@/components/member/community/GroupsPage";

export const metadata: Metadata = { title: "Communauté" };

export default function Page() {
  return <GroupsPage />;
}
