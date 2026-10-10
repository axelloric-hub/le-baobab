import localFont from "next/font/local";

/**
 * Polices auto-hébergées (licence SIL OFL, fichiers dans ./fonts) :
 * aucune requête vers Google Fonts, ni au build ni à l'exécution.
 *  - Inter : interface et titres (proche de la référence).
 *  - Outfit : nom de marque « LE BAOBAB » et signature, comme dans le logo.
 */
export const interFont = localFont({
  src: "./fonts/Inter-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

export const outfitFont = localFont({
  src: "./fonts/Outfit-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-outfit",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});
