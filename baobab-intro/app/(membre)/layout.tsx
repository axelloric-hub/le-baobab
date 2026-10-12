import type { Metadata } from "next";
import { MemberApp } from "@/components/member/MemberApp";

/** Espace membre : pages privées, jamais indexées. */
export const metadata: Metadata = {
  title: { default: "LE BAOBAB", template: "%s · LE BAOBAB" },
  robots: { index: false, follow: false },
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <MemberApp>{children}</MemberApp>;
}
