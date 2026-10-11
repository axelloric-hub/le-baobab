/**
 * Client HTTP de l'API LE BAOBAB (navigateur). Envoie et reçoit du JSON, ajoute le jeton
 * d'accès si demandé, convertit toute erreur en ApiError. Aucun cookie n'est envoyé :
 * l'authentification passe par l'en-tête Authorization (JWT).
 */
import { API_BASE_URL, API_TIMEOUT_MS } from "./config";
import { ApiError, type FieldErrors } from "./errors";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Jeton d'accès JWT (requêtes authentifiées). */
  accessToken?: string;
  signal?: AbortSignal;
}

function normalizeFields(raw: unknown): FieldErrors {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FieldErrors = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = Array.isArray(value) ? value.map(String) : [String(value)];
  }
  return out;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, accessToken, signal } = options;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), API_TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      signal: timeout.signal,
    });
  } catch {
    throw new ApiError(0, timeout.signal.aborted && !signal?.aborted ? "timeout" : "network_error");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (response.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; fields?: unknown } } | null)?.error;
    const retryAfter = Number(response.headers.get("retry-after")) || undefined;
    const fallback = response.status === 429 ? "rate_limited" : response.status >= 500 ? "server_error" : "error";
    throw new ApiError(response.status, error?.code ?? fallback, error?.message ?? "", normalizeFields(error?.fields), retryAfter);
  }
  return data as T;
}
