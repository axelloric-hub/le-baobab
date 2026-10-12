/**
 * Conventions du champ libre « payload » des publications (le backend accepte un objet JSON).
 * Le composeur écrit ces formes ; les cartes les lisent avec prudence (données venues d'ailleurs).
 */
export interface CodePayload {
  language: string;
  filename?: string;
  code: string;
}

export interface LinkPayload {
  url: string;
}

export interface ProjectPayload {
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
  repository_url?: string;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function readCode(payload: unknown): CodePayload | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  const code = str(p.code);
  return code ? { language: str(p.language), filename: str(p.filename) || undefined, code } : null;
}

/** Seules les adresses http(s) sont affichées comme liens. */
export function safeUrl(value: unknown): string | null {
  const raw = str(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function readLink(payload: unknown): LinkPayload | null {
  const url = safeUrl((payload as Record<string, unknown> | null)?.url);
  return url ? { url } : null;
}

export function readProject(payload: unknown): ProjectPayload | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  const name = str(p.name) || str(p.full_name);
  if (!name) return null;
  const technologies = Array.isArray(p.technologies) ? p.technologies.filter((t): t is string => typeof t === "string").slice(0, 8) : [];
  return {
    name,
    description: str(p.description) || undefined,
    technologies,
    url: safeUrl(p.url) ?? undefined,
    repository_url: safeUrl(p.repository_url) ?? safeUrl(p.html_url) ?? undefined,
  };
}
