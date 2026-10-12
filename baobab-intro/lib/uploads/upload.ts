/**
 * Envoi de fichier en 3 étapes (le contenu ne passe JAMAIS par l'API) :
 *   1. POST /files/uploads/        → URL signée + en-têtes
 *   2. PUT  <url signée>           → envoi direct au bucket (progression réelle)
 *   3. POST /files/{id}/complete/  → le serveur vérifie taille et type
 * Retourne l'identifiant du fichier, à référencer ensuite (media[].file, file…).
 */
import { authed } from "@/lib/api/authed";
import { ApiError } from "@/lib/api/errors";

export type UploadPurpose = "post_media" | "status_media" | "message_attachment" | "avatar" | "cover";

export interface PurposeRule {
  purpose: string;
  allowed_types: string[];
  max_size_bytes: number;
  public: boolean;
}

interface UploadTicket {
  file_id: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expires_in: number;
}

export interface UploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

let rulesCache: Promise<PurposeRule[]> | null = null;

/** Types et tailles autorisés par usage (GET /files/purposes/, mis en cache). */
export function purposeRules(): Promise<PurposeRule[]> {
  rulesCache ??= authed<PurposeRule[]>("/files/purposes/").catch((error) => {
    rulesCache = null;
    throw error;
  });
  return rulesCache;
}

/** Vérification avant envoi : message clair au lieu d'un refus du serveur. */
export async function checkFile(file: File, purpose: UploadPurpose): Promise<string | null> {
  const rule = (await purposeRules()).find((r) => r.purpose === purpose);
  if (!rule) return null;
  if (!rule.allowed_types.includes(file.type)) return `Type de fichier non accepté (${file.type || "inconnu"}).`;
  if (file.size > rule.max_size_bytes) return `Fichier trop lourd : ${Math.round(rule.max_size_bytes / 1_048_576)} Mo maximum.`;
  return null;
}

function put(ticket: UploadTicket, file: File, options: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method, ticket.url);
    for (const [name, value] of Object.entries(ticket.headers ?? {})) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, "upload_failed")));
    xhr.onerror = () => reject(new ApiError(0, "network_error"));
    xhr.onabort = () => reject(new ApiError(0, "upload_aborted"));
    options.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

export async function uploadFile(file: File, purpose: UploadPurpose, options: UploadOptions = {}): Promise<string> {
  const problem = await checkFile(file, purpose);
  if (problem) throw new ApiError(400, "invalid_file_local", problem);
  const ticket = await authed<UploadTicket>("/files/uploads/", {
    method: "POST",
    body: { purpose, filename: file.name, content_type: file.type, size_bytes: file.size },
    signal: options.signal,
  });
  await put(ticket, file, options);
  options.onProgress?.(1);
  await authed(`/files/${ticket.file_id}/complete/`, { method: "POST", body: {} });
  return ticket.file_id;
}
