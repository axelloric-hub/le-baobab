import type { Metadata, Viewport } from "next";
import { interFont, outfitFont } from "@/components/landing/fonts";
import { INTRO_GATE_SCRIPT } from "@/components/landing/intro-gate-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "LE BAOBAB — Le réseau racine des devs africains",
  description:
    "LE BAOBAB réunit les développeurs africains autour de leurs échanges, de leurs apprentissages et de leurs projets, et les relie aux opportunités.",
};

export const viewport: Viewport = {
  themeColor: "#fbf8f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-intro est posé par le script ci-dessous avant le premier affichage :
    // l'attribut diffère donc volontairement entre serveur et client.
    <html lang="fr" className={`${interFont.variable} ${outfitFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_GATE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
