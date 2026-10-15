/**
 * Erreurs de l'API. Le backend répond toujours {"error": {"code", "message", "fields"?}} ;
 * le frontend se fie au CODE et affiche ses propres messages (accentués, homogènes).
 */
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverMessage: string;
  readonly fields: FieldErrors;
  readonly retryAfter?: number;

  constructor(status: number, code: string, serverMessage = "", fields: FieldErrors = {}, retryAfter?: number) {
    super(serverMessage || code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

/** Messages affichés à l'utilisateur, par code d'erreur du backend. */
const MESSAGES: Record<string, string> = {
  // Réseau et serveur
  network_error: "Impossible de joindre le serveur. Vérifiez votre connexion Internet, puis réessayez.",
  timeout: "Le serveur met trop de temps à répondre. Réessayez dans un instant.",
  origin_unavailable: "Le serveur démarre (cela peut prendre jusqu'à une minute). Réessayez dans un instant.",
  server_error: "Une erreur est survenue côté serveur. Réessayez dans un instant.",
  rate_limited: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  validation_error: "Certaines informations sont invalides : vérifiez les champs signalés.",
  // Inscription et connexion
  email_taken: "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez « Mot de passe oublié ».",
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_verified: "Confirmez d'abord votre e-mail avec le code reçu.",
  account_suspended: "Ce compte est suspendu. Contactez l'équipe LE BAOBAB.",
  account_gone: "Ce compte n'existe plus.",
  login_rate_limited: "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
  not_authenticated: "Votre session a expiré : reconnectez-vous.",
  // Codes à 6 chiffres
  otp_expired: "Ce code a expiré ou n'existe plus : demandez-en un nouveau.",
  otp_locked: "Trop d'essais avec ce code : demandez-en un nouveau.",
  otp_invalid: "Code incorrect.",
  otp_cooldown: "Patientez quelques secondes avant de redemander un code.",
  otp_ip_limited: "Trop de demandes de code depuis votre connexion. Réessayez plus tard.",
  // Connexion avec GitHub
  github_not_configured: "La connexion avec GitHub n'est pas encore activée sur le serveur.",
  github_access_denied: "Connexion GitHub annulée.",
  github_callback_invalid: "Le retour de GitHub est incomplet : recommencez.",
  github_state_invalid: "La demande de connexion a expiré : recommencez.",
  github_code_invalid: "Le code GitHub a expiré ou a déjà servi : recommencez.",
  github_exchange_failed: "GitHub a refusé la connexion. Réessayez plus tard.",
  github_unreachable: "GitHub est injoignable pour le moment. Réessayez dans un instant.",
  github_bad_response: "Réponse inattendue de GitHub. Réessayez dans un instant.",
  github_profile_failed: "Impossible de lire votre profil GitHub. Réessayez dans un instant.",
  github_rate_limited: "Trop de demandes vers GitHub. Réessayez dans quelques minutes.",
  github_api_failed: "GitHub n'a pas pu répondre. Réessayez dans un instant.",
  github_email_unverified:
    "Votre compte GitHub n'a aucune adresse e-mail vérifiée. Vérifiez-en une dans les paramètres GitHub (Emails), puis recommencez.",
  email_taken_connect_instead:
    "Un compte LE BAOBAB existe déjà avec l'adresse e-mail de ce compte GitHub. Connectez-vous avec votre mot de passe.",
  github_already_linked: "Ce compte GitHub est déjà lié à un autre compte LE BAOBAB.",
  signup_conflict: "Conflit lors de la création du compte : recommencez.",
  ticket_invalid: "La connexion GitHub a expiré : recommencez.",
  // Droits et états (communs à toutes les applications)
  forbidden: "Vous n'avez pas le droit de faire cette action.",
  not_found: "Cet élément n'existe plus ou n'est pas visible pour vous.",
  not_pending: "Cette demande a déjà été traitée.",
  expired: "Cette invitation a expiré.",
  slug_taken: "Cette adresse est déjà prise : choisissez-en une autre.",
  // Communauté
  already_member: "Vous êtes déjà membre.",
  already_requested: "Votre demande est déjà en attente.",
  already_invited: "Cette personne a déjà une invitation en attente.",
  invite_only: "Ce groupe n'accepte que les personnes invitées.",
  banned: "Vous ne pouvez pas rejoindre ce groupe.",
  owner_cannot_leave: "Le propriétaire ne peut pas quitter son groupe.",
  group_post_forbidden: "Vous ne pouvez pas publier dans ce groupe.",
  muted: "Vous êtes en sourdine dans ce groupe pour le moment.",
  archived: "Ce groupe est archivé.",
};

/** Message lisible pour n'importe quelle erreur (ApiError ou autre). */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "otp_invalid") {
      const left = /(\d+)\s*essai/.exec(error.serverMessage)?.[1];
      if (left !== undefined) return `Code incorrect. Il vous reste ${left} essai${Number(left) > 1 ? "s" : ""}.`;
    }
    if (error.code === "otp_cooldown") {
      const wait = /(\d+)\s*s/.exec(error.serverMessage)?.[1];
      if (wait) return `Patientez ${wait} s avant de redemander un code.`;
    }
    return MESSAGES[error.code] ?? (error.status >= 500 ? MESSAGES.server_error : error.serverMessage || MESSAGES.server_error);
  }
  return MESSAGES.server_error;
}

/** Premier message d'erreur d'un champ renvoyé par le serveur (validation_error). */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const messages = error.fields[field];
  return Array.isArray(messages) && messages.length > 0 ? String(messages[0]) : undefined;
}
