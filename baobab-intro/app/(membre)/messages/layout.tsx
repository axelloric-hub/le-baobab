import type { Metadata } from "next";
import { MessagesShell } from "@/components/member/messages/MessagesShell";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
