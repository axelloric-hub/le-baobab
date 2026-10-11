/**
 * Blog — tous les textes (maquette Stitch, réécrite selon la règle éditoriale).
 *
 * Aucun article n'est encore publié : les cartes ci-dessous sont des sujets annoncés
 * (« Exemple de mise en page »), sans auteur ni date ni compteur inventés.
 * Seul l'article modèle « Idempotence et webhooks » est rédigé, pour montrer la mise en page.
 *
 * Publier un vrai article : l'ajouter à BLOG_POSTS avec `slug` et `status: "published"`,
 * puis créer son contenu (voir article-idempotence.ts) et sa route dans app/blog/[slug].
 */

export const BLOG_META = {
  title: "Blog — LE BAOBAB",
  description:
    "Tutoriels, parcours de développeurs et idées pour construire la prochaine génération de projets numériques africains.",
};

export const BLOG_CATEGORIES = [
  "Développement & ingénierie",
  "Parcours de développeurs",
  "Construire en Afrique",
  "Projets & initiatives",
  "Apprendre ensemble",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_ALL_LABEL = "Tous";

export const BLOG_HERO = {
  badge: "Éditorial & partage",
  titleLines: ["Les idées prennent racine.", "Les projets prennent forme."],
  subtitle: "Apprendre, partager et comprendre la tech qui se construit autour de nous.",
  filtersLabel: "Filtrer les articles par thème",
};

export const LAYOUT_EXAMPLE = "Exemple de mise en page";

export const BLOG_FEATURED = {
  kicker: "À la une · Édition racine",
  category: "Développement & ingénierie" as BlogCategory,
  meta: "7 min de lecture · Article à paraître",
  title: "Concevoir des architectures résilientes face aux contraintes d'infrastructure locale",
  excerpt:
    "Comment structurer des services asynchrones, gérer les coupures réseau intermittentes et fiabiliser les intégrations d'API financières à travers le continent, sans sacrifier la cohérence des données.",
  coverLabel: "brouillon",
  author: { initials: "LB", name: "La rédaction LE BAOBAB", role: "Revue d'ingénierie" },
  action: "Lire l'article",
};

export interface BlogPost {
  title: string;
  excerpt: string;
  category: BlogCategory;
  readingTime: string;
  tags: string;
  /** Page existante (article modèle) ; sans slug, la carte n'est pas cliquable. */
  slug?: string;
}

export const BLOG_GRID = {
  eyebrow: "Série Réflexions & Chantiers",
  title: "Les prochains dossiers techniques",
  lead: "Une sélection d'analyses, de récits de mise en production et de modèles d'architecture, partagés par des artisans du code africain.",
  empty: "Aucun article dans ce thème pour le moment.",
  readModel: "Voir la mise en page",
};

export const BLOG_POSTS: BlogPost[] = [
  {
    title: "Idempotence et webhooks : fiabiliser les paiements Mobile Money en production",
    excerpt: "Réessais exponentiels et clés uniques pour éviter les doubles débits, même sous forte latence.",
    category: "Développement & ingénierie",
    readingTime: "8 min de lecture",
    tags: "#backend #fintech",
    slug: "idempotence-webhooks",
  },
  {
    title: "Du script artisanal au système distribué : le parcours d'une infrastructure panafricaine",
    excerpt: "Retour d'expérience sur la migration progressive d'un monolithe vers plusieurs régions cloud, sans interruption de service.",
    category: "Parcours de développeurs",
    readingTime: "8 min de lecture",
    tags: "#devops #architecture",
  },
  {
    title: "Pourquoi l'architecture offline-first est un standard d'ingénierie incontournable",
    excerpt: "Concevoir des applications mobiles qui résolvent d'abord les conflits en local, grâce aux CRDT et au stockage embarqué.",
    category: "Construire en Afrique",
    readingTime: "6 min de lecture",
    tags: "#mobile #offline-first",
  },
  {
    title: "Modéliser des schémas relationnels optimisés pour les grosses bases PostgreSQL",
    excerpt: "Index partiels, partitionnement par date et réduction drastique des verrous sur de gros volumes.",
    category: "Développement & ingénierie",
    readingTime: "10 min de lecture",
    tags: "#sql #postgresql",
  },
  {
    title: "Ouvrir son code : retour sur la publication d'une bibliothèque open source locale",
    excerpt: "Accueillir les premières contributions, formaliser la gouvernance et maintenir un paquet communautaire dans la durée.",
    category: "Projets & initiatives",
    readingTime: "5 min de lecture",
    tags: "#opensource #communauté",
  },
  {
    title: "Structurer un programme de mentorat technique efficace entre pairs",
    excerpt: "Former des binômes d'apprentissage équilibrés, du déblocage d'algorithmes aux vraies revues de code.",
    category: "Apprendre ensemble",
    readingTime: "7 min de lecture",
    tags: "#mentorat #partage",
  },
];

export const BLOG_NOTICE = {
  kicker: "En coulisses de la rédaction",
  /** Texte imposé par la maquette. */
  text: "Nos premiers articles sont en préparation. Bientôt, nous partagerons ici des tutoriels, des expériences de développeurs et des idées pour construire la prochaine génération de projets numériques.",
  notify: "Être notifié des parutions",
  join: "S'inscrire à la communauté",
};

export const BLOG_CTA = {
  eyebrow: "Rejoindre l'artisanat numérique",
  title: "Un problème à résoudre ? Une idée à partager ? Prenez votre place dans le réseau.",
  text: "Rejoignez les ingénieurs, architectes et makers qui échangent sans filtre sur le code, l'infrastructure et le déploiement sur le terrain.",
  primary: "Rejoindre LE BAOBAB",
};
