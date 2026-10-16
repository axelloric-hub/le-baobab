import type { Metadata } from "next";
import { ShowcasePage } from "@/components/member/showcase/ShowcasePage";

export const metadata: Metadata = { title: "Showcase" };

export default function Page() {
  return <ShowcasePage />;
}
