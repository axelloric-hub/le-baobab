/** Adresses des pages d'authentification et de l'espace membre (une seule source de vérité). */
export const ROUTES = {
  home: "/",
  login: "/connexion",
  register: "/inscription",
  verifyEmail: "/confirmation-email",
  forgotPassword: "/mot-de-passe-oublie",
  githubCallback: "/connexion/github",
  /** Arrivée après connexion : le fil d'actualité. */
  memberSpace: "/accueil",
  feed: "/accueil",
  saved: "/enregistres",
  messages: "/messages",
  conversation: (id: string) => `/messages/${id}`,
  notifications: "/notifications",
  profile: (username: string) => `/u/${encodeURIComponent(username)}`,
  post: (id: string) => `/publications/${id}`,
  hashtag: (tag: string) => `/hashtags/${encodeURIComponent(tag.replace(/^#/, "").toLowerCase())}`,
  /** Accueil forcé pour un membre déjà inscrit qui veut revoir la présentation. */
  discover: "/?decouvrir=1",
} as const;
