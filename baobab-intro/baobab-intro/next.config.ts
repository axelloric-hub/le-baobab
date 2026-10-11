import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Masque l'indicateur de développement de Next.js : la page de démo doit être propre à l'écran.
  devIndicators: false,
};

export default nextConfig;
