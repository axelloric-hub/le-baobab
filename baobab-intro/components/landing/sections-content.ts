/**
 * LE BAOBAB — contenu des sections sous le hero.
 *
 * Règle éditoriale : chaque phrase décrit une capacité réellement construite
 * côté serveur (GUIDE_BACKEND.txt). Ce qui n'est pas prêt — paiement en ligne,
 * IA, synchronisation GitHub/GitLab/LinkedIn, e-mails de notification, push,
 * vidéo en streaming — n'est jamais présenté comme disponible : soit il est
 * omis, soit il est annoncé explicitement comme « à venir ».
 *
 * Aucun chiffre d'usage (membres, avis, pays, disponibilité…) : les seuls
 * nombres affichés décrivent le produit lui-même et sont vérifiables dans le code.
 *
 * href absent → la destination n'existe pas encore : l'élément est affiché sans lien.
 */

/* ------------------------------------------------------------------ */
/* Ancres internes (utilisées par la navigation)                       */
/* ------------------------------------------------------------------ */

export const SECTION_IDS = {
  problem: "probleme",
  platform: "plateforme",
  workspace: "espace-de-travail",
  stats: "chiffres",
  copilot: "copilot",
  integrations: "integrations", // cible du lien « Ressources » de la navigation
  security: "securite",
  faq: "faq",
  cta: "rejoindre",
} as const;

/* ------------------------------------------------------------------ */
/* 1. Constat                                                          */
/* ------------------------------------------------------------------ */

export const PROBLEM = {
  eyebrow: "Le constat",
  title: "Vos échanges, vos cours, vos projets et vos opportunités vivent sur des plateformes qui s'ignorent.",
  body: "Une question se règle sur un forum, une compétence s'acquiert sur un site de cours, un projet dort dans un dépôt, une offre arrive par une autre porte. Rien ne relie ce que vous savez faire à ceux qui en ont besoin.",
  answer:
    "LE BAOBAB réunit ces espaces autour d'un seul profil : ce que vous partagez, apprenez et construisez devient visible pour la communauté comme pour ceux qui recrutent.",
  /** Les cinq lieux éparpillés du visuel (catégories, pas de marques). */
  scattered: ["Forums", "Messageries", "Sites de cours", "Dépôts de code", "Sites d'emploi"],
};

/* ------------------------------------------------------------------ */
/* 2. Pour qui (cinq cartes)                                           */
/* ------------------------------------------------------------------ */

export type ChannelIcon = "code" | "forum" | "work" | "school" | "server" | "building" | "shop";

export const CHANNELS = {
  eyebrow: "La plateforme",
  title: "Une place pour chaque bâtisseur",
  lead: "Développeurs, formateurs, freelances, entreprises, créateurs : chacun y trouve ses outils, et ceux avec qui travailler.",
  items: [
    {
      icon: "code" as ChannelIcon,
      tone: "brown",
      title: "Développeurs",
      text: "Publiez, échangez en groupes ou en privé, et rassemblez vos projets dans un portfolio qui vous suit.",
      action: "Rejoindre",
    },
    {
      icon: "school" as ChannelIcon,
      tone: "blue",
      title: "Formateurs",
      text: "Ouvrez une classe, structurez vos cours en modules et chapitres, évaluez avec quiz et devoirs.",
      action: "Enseigner",
    },
    {
      icon: "work" as ChannelIcon,
      tone: "brown",
      title: "Freelances",
      text: "Présentez vos services, répondez aux missions par une proposition et livrez par jalons.",
      action: "Proposer",
    },
    {
      icon: "building" as ChannelIcon,
      tone: "blue",
      title: "Entreprises",
      text: "Créez votre page, publiez vos offres et suivez chaque candidature jusqu'à l'embauche.",
      action: "Recruter",
    },
    {
      icon: "shop" as ChannelIcon,
      tone: "brown",
      title: "Créateurs",
      text: "Publiez templates, logiciels et ressources, avec leurs versions, leurs licences et leurs avis.",
      action: "Publier",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 3. Les quatre espaces (onglets)                                     */
/* ------------------------------------------------------------------ */

export type WorkspacePreview =
  | { kind: "terminal"; file: string; status: string; lines: Array<{ tone?: "comment" | "prompt" | "info" | "keyword" | "string" | "success"; text: string }> }
  | { kind: "thread"; channel: string; question: { author: string; text: string }; answer: { author: string; text: string } }
  | { kind: "mission"; icon?: "work" | "school"; title: string; tags: string[]; budget: string; payout: string; note: string };

export interface WorkspaceTab {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  text: string;
  bullets: string[];
  ctaLabel: string;
  preview: WorkspacePreview;
}

export const WORKSPACE = {
  title: "Quatre espaces, un seul parcours",
  lead: "Ce que vous partagez, apprenez et construisez enrichit le même profil, et ouvre la porte aux opportunités.",
  /** Les aperçus sont illustratifs : ce ne sont pas des captures du produit. */
  previewNotice: "Aperçu illustratif",
  tabs: [
    {
      id: "communaute",
      label: "Communauté",
      eyebrow: "Communauté",
      title: "Échangez là où se trouvent les bonnes réponses",
      text: "Groupes thématiques, canaux de discussion et messagerie privée ou de groupe, en temps réel.",
      bullets: [
        "Publications : texte, code, sondages, partages",
        "Statuts éphémères pour montrer un avancement",
        "Visibilité réglable sur chaque publication",
      ],
      ctaLabel: "Rejoindre un groupe",
      preview: {
        kind: "thread",
        channel: "Groupe Backend · #django",
        question: {
          author: "Awa · Dakar",
          text: "Comment éviter de débiter deux fois un client si le webhook Mobile Money arrive en double ?",
        },
        answer: {
          author: "Koffi · Lomé",
          text: "Rends le traitement idempotent : enregistre l'identifiant de l'événement et ignore tout doublon avant d'écrire en base.",
        },
      },
    },
    {
      id: "learn",
      label: "Learn",
      eyebrow: "Learn",
      title: "Apprenez, puis enseignez à votre tour",
      text: "Les formateurs ouvrent des classes et organisent leurs cours en modules et chapitres. Chaque apprenant suit sa progression, chapitre par chapitre.",
      bullets: [
        "Texte, vidéo, PDF, notebooks, extraits de code",
        "Quiz corrigés automatiquement, devoirs notés",
        "Certificat délivré quand le cours est réussi",
      ],
      ctaLabel: "Découvrir les cours",
      preview: {
        kind: "mission",
        icon: "school",
        title: "API REST avec Django : de zéro à la mise en ligne",
        tags: ["Débutant", "Français", "4 modules", "Quiz"],
        budget: "Certificat vérifiable par code à la réussite",
        payout: "Progression enregistrée chapitre par chapitre",
        note: "Cours fictif, à titre d'illustration",
      },
    },
    {
      id: "showcase",
      label: "Showcase",
      eyebrow: "Showcase",
      title: "Laissez vos projets parler pour vous",
      text: "Un portfolio qui rassemble projets, technologies, dépôts, expériences, formations et certificats obtenus sur la plateforme.",
      bullets: [
        "Projets avec captures, liens et technologies",
        "Dépôts de code référencés",
        "Certificats LE BAOBAB vérifiés par la plateforme",
      ],
      ctaLabel: "Créer mon portfolio",
      preview: {
        kind: "terminal",
        file: "portfolio.json",
        status: "visibilité : public",
        lines: [
          { tone: "comment", text: "// Portfolio de Fatou · Développeuse full-stack" },
          { text: "{" },
          { tone: "keyword", text: '  "projets": [' },
          { tone: "string", text: '    { "titre": "Kassa", "stack": ["Django", "React"] },' },
          { tone: "string", text: '    { "titre": "AgriSMS", "stack": ["Python", "USSD"] }' },
          { text: "  ]," },
          { tone: "keyword", text: '  "depots": ["kassa-api", "agrisms"],' },
          { tone: "keyword", text: '  "certificats": [' },
          { tone: "string", text: '    { "cours": "API REST avec Django", "code": "BB-7Q4X-2KD9" }' },
          { text: "  ]" },
          { text: "}" },
          { text: "" },
          { tone: "success", text: "✓ Certificat vérifié : valide" },
        ],
      },
    },
    {
      id: "opportunites",
      label: "Opportunités",
      eyebrow: "Opportunités",
      title: "Des offres reliées à ce que vous savez faire",
      text: "Emplois et missions freelance sont publiés au même endroit que les profils et les portfolios. Les entreprises suivent chaque candidature, de la présélection à l'offre.",
      bullets: [
        "Candidatures avec projets du portfolio joints",
        "Entretiens planifiés, offres d'embauche",
        "Missions freelance : proposition, contrat, jalons",
      ],
      ctaLabel: "Voir les offres",
      preview: {
        kind: "mission",
        title: "Mission freelance : intégration d'une API de paiement",
        tags: ["Python", "Django", "REST", "À distance"],
        budget: "Contrat signé · livraison en 3 jalons",
        payout: "Chaque jalon validé par le client",
        note: "Mission fictive, à titre d'illustration",
      },
    },
  ] satisfies WorkspaceTab[],
};

/* ------------------------------------------------------------------ */
/* 4. Repères (faits produit vérifiables, pas des statistiques d'usage) */
/* ------------------------------------------------------------------ */

export const STATS = {
  /** Ces valeurs décrivent le produit (voir le code), pas son audience : pas de mention « démo ». */
  isDemo: false,
  showDemoNotice: false,
  items: [
    {
      value: "1 profil",
      title: "Pour tout votre parcours",
      text: "Compétences, publications, cours suivis, projets et candidatures reposent sur la même identité.",
      tag: "Profil & portfolio",
    },
    {
      value: "6 formats",
      title: "De questions de quiz",
      text: "Choix unique ou multiple, vrai/faux, réponse courte, mise en ordre, et code corrigé par le formateur.",
      tag: "Learn",
    },
    {
      value: "24 h",
      title: "La vie d'un statut",
      text: "Une démo, une question, un avancement : le statut éphémère disparaît du fil après une journée.",
      tag: "Communauté",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 5. IA BAOBAB — annoncée comme à venir (la passerelle IA n'existe pas) */
/* ------------------------------------------------------------------ */

export const COPILOT = {
  badge: "En préparation",
  title: "IA BAOBAB : un assistant au service de la communauté",
  text: "Il proposera des pistes de réponse dans les discussions, aidera les modérateurs et recommandera cours, projets et offres en lien avec votre profil.",
  highlights: [
    { title: "Réponses contextuelles", text: "Une première piste sur les questions techniques des groupes", tone: "brown" },
    { title: "Recommandations", text: "Cours, projets et offres adaptés à votre parcours", tone: "blue" },
  ],
  chat: {
    assistant: "IA BAOBAB",
    mode: "Assistant communautaire",
    /** La fonctionnalité n'existe pas encore : le badge le dit. */
    status: "Bientôt",
    questionLabel: "Question dans le groupe Backend :",
    question:
      "Comment gérer une file de transactions Mobile Money si le webhook de l'opérateur répond avec 45 secondes de retard ?",
    answerLabel: "Piste proposée :",
    answerStrong: "Transactional Outbox avec nouvelles tentatives espacées",
    answerBefore: "Appliquez le pattern ",
    answerAfter:
      " : enregistrez la transaction avant l'appel à l'opérateur, puis confirmez-la au client dès réception du webhook.",
    /** Ligne de code illustrative (aucun paquet fictif). */
    command: "retry : backoff + jitter, 5 max",
  },
};

/* ------------------------------------------------------------------ */
/* 6. Ressources : les supports de cours (cible du lien « Ressources ») */
/* ------------------------------------------------------------------ */

export type IntegrationIcon =
  | "terminal"
  | "merge"
  | "editor"
  | "container"
  | "hub"
  | "cloud"
  | "code"
  | "phone"
  | "database"
  | "document"
  | "video"
  | "audio"
  | "slides"
  | "link"
  | "quiz"
  | "school";

export const INTEGRATIONS = {
  eyebrow: "Ressources",
  title: "Chaque chapitre, le bon support",
  lead: "Les formateurs composent leurs cours avec les formats adaptés à chaque notion, puis évaluent avec des quiz et des exercices.",
  items: [
    { name: "Texte", icon: "document" as IntegrationIcon },
    { name: "PDF & documents", icon: "document" as IntegrationIcon },
    { name: "Vidéo", icon: "video" as IntegrationIcon },
    { name: "Audio", icon: "audio" as IntegrationIcon },
    { name: "Extraits de code", icon: "editor" as IntegrationIcon },
    { name: "Notebooks", icon: "terminal" as IntegrationIcon },
    { name: "Présentations", icon: "slides" as IntegrationIcon },
    { name: "Liens & contenus intégrés", icon: "link" as IntegrationIcon },
    { name: "Quiz", icon: "quiz" as IntegrationIcon },
    { name: "Exercices", icon: "school" as IntegrationIcon },
    { name: "Dépôts de code", icon: "merge" as IntegrationIcon },
  ],
  ctaLabel: "Explorer les cours",
};

/* ------------------------------------------------------------------ */
/* 7. Confidentialité et sécurité (mesures présentes dans le code)     */
/* ------------------------------------------------------------------ */

export const SECURITY = {
  eyebrow: "Confidentialité",
  title: "Vous décidez de qui voit quoi",
  text: "Chaque publication, statut et portfolio a son niveau de visibilité : public, abonnés, amis, amis proches, membres d'un groupe ou audience choisie. Bloquer quelqu'un le retire de tout ce que vous partagez.",
  checks: ["E-mail vérifié à l'inscription", "Signalement et modération", "Droit à l'effacement"],
  badge: {
    title: "Comptes isolés",
    text: "Personne n'accède aux données d'un autre compte. Les fichiers privés ne s'ouvrent que par des liens temporaires.",
    tag: "Accès contrôlé",
  },
};

/* ------------------------------------------------------------------ */
/* 8. FAQ                                                              */
/* ------------------------------------------------------------------ */

export const FAQ = {
  title: "Questions fréquentes",
  items: [
    {
      question: "Qu'est-ce que LE BAOBAB ?",
      answer:
        "Une plateforme pour les développeurs africains qui relie quatre espaces : la Communauté pour échanger, Learn pour apprendre et enseigner, Showcase pour présenter ses projets, et Opportunités pour trouver un emploi, une mission ou un client.",
    },
    {
      question: "À qui s'adresse la plateforme ?",
      answer:
        "Aux développeurs, mais aussi aux formateurs qui créent des cours, aux freelances qui proposent leurs services, aux entreprises qui recrutent et aux créateurs qui publient des produits numériques.",
    },
    {
      question: "Comment fonctionnent les certificats ?",
      answer:
        "Quand le cours le prévoit, un certificat est délivré une fois le cours terminé et tous ses quiz réussis. Il porte un code que chacun peut vérifier publiquement, et vous pouvez l'afficher dans votre portfolio.",
    },
    {
      question: "Puis-je relier mon compte GitHub ?",
      answer:
        "Vous pouvez déjà référencer vos dépôts et les liens de vos projets dans votre portfolio. La connexion directe à GitHub, GitLab et LinkedIn, avec synchronisation automatique, est prévue.",
    },
    {
      question: "Les cours et produits payants sont-ils disponibles ?",
      answer:
        "Les formateurs et les créateurs peuvent fixer un prix à un cours, un module ou un produit. Le paiement en ligne n'est pas encore ouvert : le branchement d'un prestataire (Mobile Money, carte) est la prochaine étape prévue.",
    },
    {
      question: "Comment les entreprises recrutent-elles ?",
      answer:
        "Une entreprise crée sa page, publie ses offres et suit chaque candidature : présélection, entretien, offre d'embauche. Pour une mission, les freelances répondent par une proposition et le travail se livre par jalons.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 9. Bandeau d'appel à l'action                                       */
/* ------------------------------------------------------------------ */

export const CTA_BANNER = {
  title: "Prêt à prendre racine ?",
  text: "Créez votre profil, rejoignez vos premiers groupes et faites grandir vos projets avec la communauté.",
  primary: "Créer mon profil", // pas encore de parcours d'inscription : visuel uniquement
  secondary: "Revoir l'intro", // rejoue la cinématique (comportement inchangé)
};

/* ------------------------------------------------------------------ */
/* 10. Pied de page                                                    */
/* ------------------------------------------------------------------ */

export interface FooterLink {
  label: string;
  href?: string;
}

export const FOOTER = {
  pitch: "La plateforme qui relie les développeurs africains pour échanger, apprendre, construire et grandir.",
  columns: [
    {
      title: "Plateforme",
      links: [{ label: "Communauté" }, { label: "Learn" }, { label: "Showcase" }, { label: "Opportunités" }, { label: "Boutiques" }] as FooterLink[],
    },
    {
      title: "Pour qui",
      links: [{ label: "Développeurs" }, { label: "Formateurs" }, { label: "Freelances" }, { label: "Entreprises" }, { label: "Créateurs" }] as FooterLink[],
    },
    {
      title: "Ressources",
      links: [{ label: "Guide de démarrage" }, { label: "Vérifier un certificat" }, { label: "Centre d'aide" }, { label: "Nouveautés" }] as FooterLink[],
    },
    {
      title: "Communauté",
      links: [{ label: "Charte de la communauté" }, { label: "Groupes" }, { label: "Événements" }] as FooterLink[],
    },
    {
      title: "À propos",
      links: [{ label: "Notre vision" }, { label: "L'équipe" }, { label: "Contact" }] as FooterLink[],
    },
  ],
  legal: [{ label: "Confidentialité" }, { label: "Conditions" }, { label: "Mentions légales" }] as FooterLink[],
  /** Le message « pour les développeurs africains » figure déjà dans le bandeau : pas de doublon ici. */
  copyright: `© ${new Date().getFullYear()} LE BAOBAB`,
  /** Seul lien social réel : le dépôt public du projet. */
  sourceCodeUrl: "https://github.com/axelloric-hub/le-baobab",
};
