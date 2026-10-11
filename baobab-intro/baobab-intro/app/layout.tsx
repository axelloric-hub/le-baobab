import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LE BAOBAB — Cinématique d'ouverture",
  description: "Le réseau racine des devs africains",
};

export const viewport: Viewport = {
  themeColor: "#050B18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
