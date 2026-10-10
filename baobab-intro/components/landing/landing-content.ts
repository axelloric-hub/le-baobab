/**
 * LE BAOBAB — contenu de la landing page.
 *
 * Tous les textes, liens et mentions de la navigation et du hero sont ici.
 * Règle éditoriale : on ne décrit que ce que le produit fait réellement
 * (voir GUIDE_BACKEND.txt) et on n'affiche aucun chiffre d'usage inventé.
 * Les composants ne contiennent aucun texte « en dur » : pour modifier la page,
 * on modifie ce fichier.
 */
import packageJson from "../../package.json";

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export interface NavItem {
  label: string;
  /**
   * Destination réelle. Laisser `undefined` tant que la page n'existe pas :
   * l'élément reste visible mais n'est pas cliquable (aucun faux lien).
   */
  href?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/" },
  { label: "Plateforme", href: "#plateforme" }, // ancre vers une section de la page
  { label: "Communauté" }, // à raccorder
  { label: "Ressources", href: "#integrations" }, // ancre vers une section de la page
  { label: "Docs" }, // à raccorder
  { label: "Blog" }, // à raccorder
];

/** Libellé affiché au survol des éléments pas encore raccordés. */
export const PENDING_LABEL = "Bientôt disponible";

export const BRAND = {
  name: "LE BAOBAB",
  tagline: "LE RÉSEAU RACINE DES DEVS AFRICAINS",
};

/**
 * Bouton « Rejoindre » : visuel uniquement pour cette phase.
 * Volontairement sans destination ni action (raccordement ultérieur).
 */
export const JOIN_BUTTON_LABEL = "Rejoindre";

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export const HERO = {
  /** Reprend la signature de la vision du projet (« African Developer Platform »). */
  badge: "AFRICAN DEVELOPER PLATFORM",
  /** Chaque entrée = une ligne du titre sur ordinateur. */
  titleLines: [["Code ensemble."], ["Grandis ensemble."]],
  lead:
    "LE BAOBAB réunit les développeurs africains autour de leurs échanges, de leurs apprentissages et de leurs projets, et les relie aux opportunités.",
  /** Pas encore de parcours d'inscription : bouton visuel, sans action. */
  primaryCta: "Créer mon profil",
  /** Rejoue la cinématique d'ouverture (comportement inchangé). */
  secondaryCta: "Voir l'intro",
  /** Ligne centrale entre les deux filets, sous les boutons : la devise du projet. */
  motto: "Connect · Learn · Build · Grow",
  audience: "Pensé pour les développeurs africains, sur le continent comme dans la diaspora.",
};

/* ------------------------------------------------------------------ */
/* Cartes du hero : les trois espaces fondateurs de la vision          */
/* ------------------------------------------------------------------ */

export type FeatureIcon = "code" | "mentor" | "school";

export const FEATURES: Array<{ icon: FeatureIcon; title: string; description: string }> = [
  {
    icon: "mentor",
    title: "Communauté",
    description: "Groupes, canaux et messagerie en temps réel pour avancer entre pairs.",
  },
  {
    icon: "school",
    title: "Learn",
    description: "Des cours structurés, des quiz et des certificats vérifiables.",
  },
  {
    icon: "code",
    title: "Showcase",
    description: "Vos projets, dépôts et parcours réunis dans un portfolio à partager.",
  },
];

/* ------------------------------------------------------------------ */
/* Bandeau inférieur                                                   */
/* ------------------------------------------------------------------ */

/**
 * Mettre `true` uniquement quand le dépôt aura une licence open source
 * (fichier LICENSE). Aujourd'hui le dépôt n'en contient pas : la mention est masquée.
 */
export const IS_OPEN_SOURCE = false;

/** Version officielle du projet, lue dans package.json (aucune version inventée). */
export const APP_VERSION = `v${packageJson.version}`;

export const FOOTER_BAND_ITEMS = [
  "Conçu pour la communauté des développeurs africains",
  ...(IS_OPEN_SOURCE ? ["100% Open Source"] : []),
  APP_VERSION,
];
