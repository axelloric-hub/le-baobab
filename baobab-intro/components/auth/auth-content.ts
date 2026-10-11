/**
 * Textes des écrans d'authentification (maquettes Stitch, réécrites selon la règle éditoriale :
 * uniquement ce que le backend fait réellement — voir lib/auth/auth-service.ts).
 */
export const AUTH_PANEL = {
  motto: "Connect · Learn · Build · Grow",
  points: [
    "Groupes, canaux et messagerie en temps réel",
    "Cours, quiz et certificats vérifiables",
    "Un portfolio pour montrer vos projets",
  ],
};

export const AUTH_COMMON = {
  back: "Retour à l'accueil",
  required: "Requis",
  optional: "Facultatif",
  show: "Afficher le mot de passe",
  hide: "Masquer le mot de passe",
  or: "ou",
  github: "Continuer avec GitHub",
  githubLoading: "Redirection vers GitHub…",
  legal: ["Confidentialité", "Conditions"],
  serverTestCode: "Serveur en mode test : votre code est",
  fillCode: "Remplir",
};

export const REGISTER = {
  meta: { title: "Créer un compte — LE BAOBAB", description: "Rejoignez le réseau racine des développeurs africains." },
  panelTitle: "Rejoignez le réseau racine des développeurs africains.",
  badge: "Communauté panafricaine",
  title: "Créer votre compte",
  subtitle: "En moins de deux minutes.",
  email: { label: "Adresse e-mail", placeholder: "vous@exemple.org" },
  username: {
    label: "Nom d'utilisateur",
    placeholder: "aminata_code",
    hint: "3 à 30 caractères : lettres minuscules, chiffres, _ et .",
  },
  displayName: { label: "Nom affiché", placeholder: "Aminata Diallo", hint: "Votre nom ou un pseudonyme (80 caractères max.)" },
  password: {
    label: "Mot de passe",
    hint: "Au moins 10 caractères. Évitez les mots de passe courants ou uniquement composés de chiffres.",
  },
  terms: "J'accepte les conditions d'utilisation et la politique de confidentialité.",
  submit: "Créer mon compte",
  loading: "Création du compte…",
  already: "Déjà membre ?",
  login: "Se connecter",
  errors: {
    email: "Saisissez une adresse e-mail valide.",
    username: "3 à 30 caractères : lettres minuscules, chiffres, _ et . (commence par une lettre ou un chiffre).",
    passwordShort: "Le mot de passe doit contenir au moins 10 caractères.",
    passwordDigits: "Le mot de passe ne doit pas être composé uniquement de chiffres.",
    terms: "Vous devez accepter les conditions pour créer un compte.",
  },
};

export const VERIFY = {
  meta: { title: "Confirmer votre e-mail — LE BAOBAB", description: "Saisissez le code à 6 chiffres reçu par e-mail." },
  panelTitle: "Plus qu'une étape avant de rejoindre le réseau.",
  title: "Confirmez votre adresse e-mail",
  sentTo: "Nous avons envoyé un code à 6 chiffres à",
  validity: "Il est valable 10 minutes.",
  emailLabel: "Adresse e-mail du compte",
  codeLabel: "Code à 6 chiffres",
  submit: "Confirmer",
  loading: "Vérification…",
  resend: "Renvoyer un code",
  resendIn: (s: number) => `Renvoyer un code (${s} s)`,
  resent: "Un nouveau code a été envoyé. L'ancien n'est plus valable.",
  change: "Changer d'adresse e-mail",
  helpTitle: "Rien reçu ?",
  helpText: "Vérifiez vos courriers indésirables. Le message s'intitule « Votre code de confirmation LE BAOBAB ».",
  notSent: "Le code a été créé mais l'e-mail n'a pas pu partir. Réessayez avec « Renvoyer un code » dans un instant.",
  quota: "Le quota d'e-mails du jour est atteint sur le serveur. Réessayez plus tard.",
  codeIncomplete: "Saisissez les 6 chiffres du code.",
};

export const LOGIN = {
  meta: { title: "Se connecter — LE BAOBAB", description: "Connectez-vous à LE BAOBAB." },
  panelTitle: "Bon retour parmi nous.",
  badge: "Espace membre",
  title: "Se connecter",
  subtitle: "Retrouvez votre communauté, vos cours et vos projets.",
  email: { label: "Adresse e-mail", placeholder: "vous@exemple.org" },
  password: { label: "Mot de passe" },
  forgot: "Mot de passe oublié ?",
  submit: "Se connecter",
  loading: "Connexion…",
  noAccount: "Pas encore de compte ?",
  register: "Créer un compte",
  discover: "Découvrir LE BAOBAB",
  resendCode: "Recevoir un nouveau code",
  resetDone: "Votre mot de passe a été modifié. Connectez-vous avec le nouveau.",
  errors: { email: "Saisissez une adresse e-mail valide.", password: "Saisissez votre mot de passe." },
};

export const FORGOT = {
  meta: { title: "Mot de passe oublié — LE BAOBAB", description: "Réinitialisez votre mot de passe LE BAOBAB." },
  panelTitle: "On vous remet sur la bonne branche.",
  badge: "Accès sécurisé",
  steps: ["Vérification de l'e-mail", "Nouveau mot de passe"],
  title: "Mot de passe oublié",
  intro: "Indiquez votre adresse e-mail : si un compte existe, vous recevrez un code de réinitialisation.",
  email: { label: "Adresse e-mail du compte", placeholder: "vous@exemple.org" },
  send: "Recevoir un code",
  sending: "Envoi…",
  codeTitle: "Saisissez le code et votre nouveau mot de passe",
  codeSentTo: "Si un compte existe pour cette adresse, un code valable 10 minutes a été envoyé à",
  codeLabel: "Code à 6 chiffres",
  resend: "Renvoyer l'e-mail",
  newPassword: { label: "Nouveau mot de passe", hint: "Au moins 10 caractères. Évitez les mots de passe courants ou uniquement composés de chiffres." },
  submit: "Réinitialiser le mot de passe",
  submitting: "Réinitialisation…",
  security: "Par sécurité, vous serez déconnecté de tous vos appareils.",
  back: "Retour à la connexion",
  changeEmail: "Changer d'adresse e-mail",
  notSent: "L'e-mail n'a pas pu partir. Réessayez avec « Renvoyer l'e-mail » dans un instant.",
};

export const GITHUB_CALLBACK = {
  meta: { title: "Connexion avec GitHub — LE BAOBAB", description: "Connexion avec GitHub en cours." },
  panelTitle: "Bon retour parmi nous.",
  loading: "Connexion avec GitHub en cours…",
  failed: "La connexion avec GitHub n'a pas abouti",
  retry: "Revenir à la connexion",
};

export const STRENGTH_LABELS = ["Trop faible", "Faible", "Moyenne", "Forte", "Très forte"];
