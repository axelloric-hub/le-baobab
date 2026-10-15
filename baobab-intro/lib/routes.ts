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
  groups: "/groupes",
  group: (slug: string) => `/groupes/${encodeURIComponent(slug)}`,
  jobs: "/opportunites",
  job: (id: string) => `/opportunites/${id}`,
  jobManage: (id: string) => `/opportunites/${id}/candidatures`,
  company: (slug: string) => `/entreprises/${encodeURIComponent(slug)}`,
  /** Accueil forcé pour un membre déjà inscrit qui veut revoir la présentation. */
  discover: "/?decouvrir=1",
} as const;
