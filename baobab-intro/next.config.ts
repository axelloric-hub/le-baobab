import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Masque l'indicateur de développement de Next.js : la page de démo doit être propre à l'écran.
  devIndicators: false,
  async redirects() {
    // Ancienne adresse de l'espace membre (lot d'authentification) : on garde les favoris valides.
    return [{ source: "/espace", destination: "/accueil", permanent: false }];
  },
};

export default nextConfig;
