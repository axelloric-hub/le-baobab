import type { Metadata } from "next";
import { MemberSpace } from "@/components/auth/MemberSpace";

export const metadata: Metadata = { title: "LE BAOBAB", robots: { index: false } };

/** Arrivée après connexion : page blanche en attendant le design de l'espace membre. */
export default function Page() {
  return <MemberSpace />;
}
