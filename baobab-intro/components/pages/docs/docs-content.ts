/**
 * Documentation — tous les textes (maquette Stitch, réécrite selon la règle éditoriale).
 *
 * Chaque information technique vient du code du backend (GUIDE_BACKEND.txt) :
 *  - inscription : apps/accounts/api.py (register, verify_email, resend_otp) ;
 *  - code de confirmation : apps/accounts/otp.py (6 chiffres, 10 min, 5 essais, 60 s entre deux envois) ;
 *  - nom d'utilisateur : USERNAME_RE (3 à 30 caractères : a-z, 0-9, _ et .) ;
 *  - mot de passe : config/settings/base.py (AUTH_PASSWORD_VALIDATORS, 10 caractères minimum) ;
 *  - visibilités : apps/core/choices.py.
 *
 * Une entrée sans `href` est affichée mais pas cliquable (« Bientôt ») : la page n'existe pas encore.
 * Ajouter une page : créer sa route dans app/docs/<slug>/ puis renseigner son `href` ici.
 */
import { APP_VERSION } from "@/components/landing/landing-content";

export type DocsIcon = "rocket" | "forum" | "school" | "folder" | "briefcase" | "building" | "shield";

export interface DocsLink {
  label: string;
  href?: string;
}

export interface DocsPillar {
  id: string;
  icon: DocsIcon;
  title: string;
  description: string;
  links: DocsLink[];
}

export const DOCS_ACCOUNT_HREF = "/docs/creer-son-compte";

export const DOCS_VERSION = APP_VERSION;

/** Code source de la documentation (lien « Modifier sur GitHub »). */
export const DOCS_SOURCE_URL =
  "https://github.com/axelloric-hub/le-baobab/blob/main/baobab-intro/components/pages/docs/docs-content.ts";

export const DOCS_PILLARS: DocsPillar[] = [
  {
    id: "bien-demarrer",
    icon: "rocket",
    title: "Bien démarrer",
    description: "Créez votre compte, complétez votre profil et faites vos premiers pas dans le réseau.",
    links: [
      { label: "Créer son compte et confirmer son e-mail", href: DOCS_ACCOUNT_HREF },
      { label: "Configurer son profil développeur" },
      { label: "Rejoindre son premier groupe" },
    ],
  },
  {
    id: "communaute",
    icon: "forum",
    title: "Communauté & messagerie",
    description: "Groupes, canaux de discussion, publications et messagerie en temps réel.",
    links: [
      { label: "Règles des groupes et des canaux" },
      { label: "Partager du code et des projets" },
      { label: "Messagerie privée et statuts" },
    ],
  },
  {
    id: "cours",
    icon: "school",
    title: "Cours & apprentissage",
    description: "Suivez des cours structurés, passez des quiz et obtenez des certificats vérifiables.",
    links: [{ label: "Explorer les cours Learn" }, { label: "Suivi de progression et quiz" }, { label: "Vérifier un certificat" }],
  },
  {
    id: "portfolio",
    icon: "folder",
    title: "Portfolio & projets",
    description: "Présentez vos projets, vos dépôts, vos expériences et vos réalisations sur une seule page.",
    links: [
      { label: "Ajouter un projet ou un dépôt" },
      { label: "Ajouter des captures et des liens" },
      { label: "Mettre en avant ses réalisations" },
    ],
  },
  {
    id: "emplois",
    icon: "briefcase",
    title: "Emplois & freelance",
    description: "Offres d'emploi, candidatures suivies étape par étape et missions freelance découpées en jalons.",
    links: [
      { label: "Créer son profil freelance" },
      { label: "Postuler à une offre" },
      { label: "Proposer ses services sur une mission" },
    ],
  },
  {
    id: "entreprises",
    icon: "building",
    title: "Entreprises & produits",
    description: "Créez la page de votre organisation, publiez vos offres et présentez vos services.",
    links: [
      { label: "Créer une page entreprise" },
      { label: "Publier une offre d'emploi" },
      { label: "Faire vérifier son entreprise" },
    ],
  },
  {
    id: "securite",
    icon: "shield",
    title: "Confidentialité & sécurité",
    description: "Visibilité de vos contenus, blocages, appareils connectés et effacement du compte.",
    links: [{ label: "Visibilité des publications" }, { label: "Blocages et sourdines" }, { label: "Effacer son compte" }],
  },
];

/** Sous-rubriques de « Bien démarrer » dans le menu latéral. */
export const DOCS_START_LINKS: DocsLink[] = [
  { label: "Introduction", href: "/docs" },
  { label: "Créer son compte", href: DOCS_ACCOUNT_HREF },
  { label: "Configurer son profil" },
  { label: "Rejoindre son premier groupe" },
];

export const DOCS_UI = {
  sidebarTitle: "Index de la documentation",
  mobileMenu: "Menu de la documentation",
  searchLabel: "Rechercher dans la documentation",
  searchPlaceholder: "Rechercher un guide…",
  searchEmpty: "Aucun guide ne correspond à cette recherche.",
  soon: "Bientôt",
  onThisPage: "Sur cette page",
  sourceNote: "Rédigée à partir du code du backend LE BAOBAB.",
  editOnGitHub: "Modifier sur GitHub",
};

export const DOCS_META = {
  title: "Documentation — LE BAOBAB",
  description: "Guides de prise en main de LE BAOBAB : compte, communauté, cours, portfolio, emplois, entreprises et confidentialité.",
};

export const DOCS_HOME = {
  breadcrumb: "Accueil",
  badge: "Documentation officielle",
  title: "Tout commence par une bonne prise en main.",
  lead: "Bienvenue dans la documentation de **LE BAOBAB**. Vous trouverez ici les guides d'utilisation de la plateforme, domaine par domaine, pour faire grandir vos projets et prendre votre place dans le réseau racine des développeurs africains.",
  cycle: {
    title: "Le cycle du développeur",
    caption: "Un flux continu de contribution",
    steps: [
      { title: "Communauté", text: "Canaux & échanges" },
      { title: "Learn", text: "Cours & progression" },
      { title: "Showcase", text: "Projets & dépôts" },
      { title: "Opportunités", text: "Missions & emplois" },
    ],
  },
  pillars: {
    title: "Les 7 piliers de la documentation",
    lead: "Choisissez votre domaine pour consulter les guides pas à pas.",
  },
  help: {
    title: "Vous ne trouvez pas votre réponse ?",
    text: "Consultez les questions fréquentes de la page d'accueil, ou commencez par le premier guide : la création de votre compte.",
    faq: "Questions fréquentes",
    action: "Commencer le guide",
  },
  quick: {
    title: "Besoin d'aide rapide ?",
    text: "Posez votre question technique directement dans le canal d'entraide de la communauté.",
    action: "Ouvrir le canal d'entraide",
  },
  toc: [
    { id: "vue-d-ensemble", label: "Vue d'ensemble" },
    { id: "parcours-developpeur", label: "Parcours du développeur" },
    { id: "piliers", label: "Les 7 piliers" },
    { id: "aide", label: "Questions fréquentes" },
  ],
};

/* ------------------------------------------------------------------ */
/* Guide : créer son compte et confirmer son adresse e-mail             */
/* ------------------------------------------------------------------ */

export const DOCS_ACCOUNT = {
  meta: {
    title: "Créer son compte et confirmer son adresse e-mail — Docs LE BAOBAB",
    description:
      "Inscription sur LE BAOBAB : informations demandées, code de confirmation à 6 chiffres envoyé par e-mail, connexion et premiers réglages du profil.",
  },
  section: "Bien démarrer",
  breadcrumb: "Créer son compte",
  badge: "Guide initial · 4 min",
  title: "Créer son compte et confirmer son adresse e-mail",
  lead: "Un compte confirmé est nécessaire pour rejoindre la communauté, suivre des cours et présenter vos projets. Ce guide détaille chaque étape, du formulaire d'inscription à votre première connexion.",
  status:
    "L'application web est en cours de construction : ce guide décrit le parcours tel qu'il est déjà implémenté côté serveur. Les écrans montrés sont des aperçus.",
  steps: [
    {
      id: "etape-1",
      short: "1. Informations demandées",
      title: "Renseigner les informations de base",
      text: "L'inscription ne demande que le strict nécessaire :",
      items: [
        { title: "Adresse e-mail", text: "une adresse que vous consultez réellement : c'est là que vous recevrez votre code de confirmation." },
        {
          title: "Nom d'utilisateur",
          text: "de 3 à 30 caractères : lettres minuscules, chiffres, `_` et `.` (par exemple `@aminata_code`). Il sert pour vos mentions et l'adresse de votre profil.",
        },
        { title: "Nom affiché (facultatif)", text: "votre nom complet ou un pseudonyme, jusqu'à 80 caractères." },
        {
          title: "Mot de passe",
          text: "au moins 10 caractères. Il ne doit pas être trop courant, ni composé uniquement de chiffres, ni ressembler à votre e-mail ou à votre nom d'utilisateur.",
        },
      ],
      note: {
        title: "À savoir",
        text: "Votre adresse e-mail sert à vous identifier et à recevoir vos codes. Elle n'apparaît pas sur votre profil public.",
      },
    },
    {
      id: "etape-2",
      short: "2. Envoi du code",
      title: "Valider le formulaire : un code part par e-mail",
      text: "Dès l'envoi du formulaire, votre compte est créé en attente de confirmation et un **code à 6 chiffres** est envoyé à votre adresse. Il est valable **10 minutes** et un seul code est actif à la fois : en demander un nouveau annule le précédent.",
      mock: "form",
    },
    {
      id: "etape-3",
      short: "3. Confirmation de l'e-mail",
      title: "Saisir le code reçu",
      text: "Ouvrez le message intitulé **« Votre code de confirmation LE BAOBAB »** et saisissez le code à 6 chiffres sur l'écran de confirmation. Vous avez droit à 5 essais par code.",
      tip: {
        title: "Vous n'avez rien reçu ?",
        text: "Vérifiez vos courriers indésirables, puis demandez un nouveau code : il faut patienter 60 secondes entre deux envois. Si vous recommencez l'inscription avec la même adresse avant de l'avoir confirmée, un nouveau code vous est simplement renvoyé — rien d'autre n'est modifié.",
      },
      mock: "otp",
    },
    {
      id: "etape-4",
      short: "4. Première connexion",
      title: "Première connexion et personnalisation",
      text: "Une fois le code accepté, votre compte est actif et vous êtes connecté directement. Complétez ensuite votre profil : compétences (avec votre niveau), centres d'intérêt, pays, métier et liens vers vos réseaux.",
      skills: { selected: ["#python", "#react", "#django"], suggested: ["#rust", "#go", "#flutter", "#devops"] },
    },
  ],
  mockForm: {
    address: "Inscription",
    badge: "Compte",
    fields: [
      { label: "Nom d'utilisateur", value: "@aminata_code" },
      { label: "Adresse e-mail", value: "aminata@exemple.org" },
      { label: "Mot de passe", value: "••••••••••••", password: true },
    ],
    submit: "Créer mon compte",
  },
  mockOtp: {
    title: "Confirmez votre adresse e-mail",
    text: "Saisissez le code à 6 chiffres envoyé à",
    email: "aminata@exemple.org",
    digits: ["8", "4", "2", "9", "1", "0"],
    resend: "Renvoyer un code (54 s)",
    change: "Changer d'e-mail",
  },
  pagination: {
    previous: { label: "Introduction à la documentation", text: "Les grands domaines de la plateforme.", href: "/docs" },
    next: { label: "Configurer son profil développeur", text: "Compétences, centres d'intérêt et liens." },
  },
  feedback: {
    question: "Cet article vous a-t-il été utile ?",
    text: "Le vote sera disponible avec l'application.",
    yes: "Oui",
    no: "Non",
  },
  help: {
    title: "Besoin d'un coup de main ?",
    action: "Ouvrir une discussion d'entraide",
  },
  aside: {
    questionTitle: "Une question ?",
    questionText: "Un doute sur la réception du code ? Posez votre question dans le groupe d'accueil de la communauté.",
    questionAction: "Groupe Bienvenue",
  },
};
