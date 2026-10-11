/** Adresses des pages d'authentification et de l'espace membre (une seule source de vérité). */
export const ROUTES = {
  home: "/",
  login: "/connexion",
  register: "/inscription",
  verifyEmail: "/confirmation-email",
  forgotPassword: "/mot-de-passe-oublie",
  githubCallback: "/connexion/github",
  /** Arrivée après connexion (page blanche en attendant le design de l'espace membre). */
  memberSpace: "/espace",
  /** Accueil forcé pour un membre déjà inscrit qui veut revoir la présentation. */
  discover: "/?decouvrir=1",
} as const;
