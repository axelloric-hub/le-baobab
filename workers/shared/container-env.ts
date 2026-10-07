/**
 * Variables transmises au conteneur Django. Les SECRETS vivent dans le Worker (wrangler secret / CI) et sont
 * recopies ici au demarrage du conteneur : ils n'apparaissent ni dans l'image, ni dans le depot.
 * Seules les cles presentes (definies) sont transmises.
 */
export interface BackendEnv {
  // secrets
  DJANGO_SECRET_KEY: string;
  DATABASE_URL: string;
  MONGODB_URL: string;
  REDIS_URL: string;
  CHANNEL_REDIS_URL: string;
  FIELD_ENCRYPTION_KEY: string;
  INTERNAL_JOB_SECRET: string;
  // variables (non secretes)
  PUBLIC_HOST: string;
  DJANGO_ALLOWED_HOSTS: string;
  CSRF_TRUSTED_ORIGINS: string;
  CORS_ALLOWED_ORIGINS: string;
  MONGODB_DATABASE: string;
  JWT_ACCESS_LIFETIME_MINUTES?: string;
  JWT_REFRESH_LIFETIME_DAYS?: string;
  LOG_LEVEL?: string;
  API_INSTANCES?: string;
}

const PASSTHROUGH = [
  "DJANGO_SECRET_KEY", "DATABASE_URL", "MONGODB_URL", "REDIS_URL", "CHANNEL_REDIS_URL", "FIELD_ENCRYPTION_KEY",
  "INTERNAL_JOB_SECRET", "DJANGO_ALLOWED_HOSTS", "CSRF_TRUSTED_ORIGINS", "CORS_ALLOWED_ORIGINS", "MONGODB_DATABASE",
  "JWT_ACCESS_LIFETIME_MINUTES", "JWT_REFRESH_LIFETIME_DAYS", "LOG_LEVEL",
] as const;

export function containerEnv(env: BackendEnv, role: "api" | "ws"): Record<string, string> {
  const out: Record<string, string> = {
    SERVICE_ROLE: role,
    PORT: "8080",
    DJANGO_SETTINGS_MODULE: "config.settings.production",
    LOG_JSON: "true",
  };
  for (const key of PASSTHROUGH) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  return out;
}

/** Headers que SEUL le Worker a le droit de fixer : le conteneur n'est jamais joignable directement. */
export function proxied(request: Request, publicHost: string): Request {
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", publicHost);
  return new Request(request, { headers });
}
