/**
 * Couche service de l'authentification : une fonction par endpoint du backend.
 * Les pages n'appellent jamais fetch directement : elles passent par ce module.
 *
 *   POST /auth/register/          → register()
 *   POST /auth/verify-email/      → verifyEmail()      (renvoie les jetons : connecté directement)
 *   POST /auth/resend-otp/        → resendOtp()
 *   POST /auth/login/             → login()
 *   POST /auth/token/refresh/     → refreshTokens()    (rotation : l'ancien jeton est invalidé)
 *   POST /auth/logout/            → logout()
 *   POST /auth/password/forgot/   → forgotPassword()
 *   POST /auth/password/reset/    → resetPassword()    (déconnecte toutes les sessions)
 *   GET  /auth/github/start/      → startGitHubLogin()
 *   POST /auth/github/exchange/   → exchangeGitHubTicket()
 */
import { apiRequest } from "@/lib/api/client";
import type { AuthSession, AuthTokens, OtpIssue, OtpPurpose, RegisterInput, RegisterResult } from "./types";

const clean = (email: string) => email.trim().toLowerCase();

export const authService = {
  register(input: RegisterInput) {
    const body: RegisterInput = { email: clean(input.email), username: input.username.trim().toLowerCase(), password: input.password };
    if (input.display_name?.trim()) body.display_name = input.display_name.trim();
    return apiRequest<RegisterResult>("/auth/register/", { method: "POST", body });
  },

  verifyEmail(email: string, code: string) {
    return apiRequest<AuthSession>("/auth/verify-email/", { method: "POST", body: { email: clean(email), code } });
  },

  resendOtp(email: string, purpose: OtpPurpose = "verify_email") {
    return apiRequest<OtpIssue>("/auth/resend-otp/", { method: "POST", body: { email: clean(email), purpose } });
  },

  login(email: string, password: string) {
    return apiRequest<AuthSession>("/auth/login/", { method: "POST", body: { email: clean(email), password } });
  },

  refreshTokens(refresh: string) {
    return apiRequest<AuthTokens>("/auth/token/refresh/", { method: "POST", body: { refresh } });
  },

  logout(refresh: string) {
    return apiRequest<void>("/auth/logout/", { method: "POST", body: { refresh } });
  },

  forgotPassword(email: string) {
    return apiRequest<OtpIssue>("/auth/password/forgot/", { method: "POST", body: { email: clean(email) } });
  },

  resetPassword(email: string, code: string, newPassword: string) {
    return apiRequest<{ password_reset: boolean }>("/auth/password/reset/", {
      method: "POST",
      body: { email: clean(email), code, new_password: newPassword },
    });
  },

  startGitHubLogin() {
    return apiRequest<{ authorize_url: string; expires_in_seconds: number }>("/auth/github/start/");
  },

  exchangeGitHubTicket(ticket: string) {
    return apiRequest<AuthSession>("/auth/github/exchange/", { method: "POST", body: { ticket } });
  },
};
