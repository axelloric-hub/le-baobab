/** Formes des réponses de l'API d'authentification (apps/accounts/api.py, apps/integrations/api.py). */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  status: "pending" | "active" | "suspended" | string;
  email_verified: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthSession extends AuthTokens {
  user: AuthUser;
}

/** Résultat d'un envoi de code à 6 chiffres. */
export interface OtpIssue {
  email_sent: boolean;
  /** sent | daily_quota_reached | email_failed */
  reason: "sent" | "daily_quota_reached" | "email_failed" | string;
  expires_in_seconds: number;
  /** Uniquement quand le serveur est en mode test (OTP_DEBUG_ECHO=true). */
  debug_code?: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

export interface RegisterResult {
  user: AuthUser;
  otp: OtpIssue;
}

export type OtpPurpose = "verify_email" | "reset_password";
