/**
 * Worker "baobab-router" (plan Cloudflare GRATUIT, aucun conteneur).
 *   /ws/*  et  /api/ /admin/ /static/ /health/ /ready/   -> origine Django hebergee sur Render (ORIGIN_URL)
 *   tout le reste                                          -> frontend Next.js sur Vercel (FRONTEND_ORIGIN)
 * Il pose des en-tetes de confiance (secret partage EDGE_SHARED_SECRET) : Django refuse tout acces qui ne vient pas d'ici.
 */
interface Env {
  ORIGIN_URL: string; // ex: https://baobab-api.onrender.com
  FRONTEND_ORIGIN: string; // ex: https://le-baobab.vercel.app
  PUBLIC_HOST: string; // ex: baobab-router.<compte>.workers.dev
  EDGE_SHARED_SECRET: string; // secret (wrangler secret)
}

const ORIGIN_PREFIXES = ["/api/", "/admin/", "/static/", "/health/", "/ready/"];
const STRIP = ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-internal-timestamp", "x-internal-signature", "x-edge-secret"];

function hardened(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const h of STRIP) headers.delete(h); // jamais d'en-tete de confiance venant d'Internet
  const incoming = request.headers.get("x-request-id") ?? "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(incoming)) headers.set("x-request-id", crypto.randomUUID().replaceAll("-", ""));
  return new Request(request, { headers });
}

function toOrigin(request: Request, env: Env): Request {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set("x-edge-secret", env.EDGE_SHARED_SECRET);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", env.PUBLIC_HOST);
  return new Request(new URL(url.pathname + url.search, env.ORIGIN_URL), new Request(request, { headers }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const req = hardened(request);
    const requestId = req.headers.get("x-request-id")!;

    if (url.pathname.startsWith("/internal/")) return new Response("Not found", { status: 404 }); // jamais expose

    const toDjango = url.pathname === "/ws" || url.pathname.startsWith("/ws/") || url.pathname === "/admin" || ORIGIN_PREFIXES.some((p) => url.pathname.startsWith(p));
    if (toDjango) {
      try {
        const response = await fetch(toOrigin(req, env)); // un Upgrade: websocket est relaye tel quel
        if (response.status === 101) return response;
        const out = new Response(response.body, response);
        out.headers.set("x-request-id", requestId);
        return out;
      } catch {
        // L'origine gratuite se reveille en ~1 min : message explicite plutot qu'une erreur opaque.
        return Response.json({ error: { code: "origin_unavailable", message: "Le serveur demarre, reessayez dans une minute." } }, { status: 503, headers: { "retry-after": "30", "x-request-id": requestId } });
      }
    }

    const upstream = new URL(url.pathname + url.search, env.FRONTEND_ORIGIN);
    const response = await fetch(new Request(upstream, req));
    const out = new Response(response.body, response);
    out.headers.set("x-request-id", requestId);
    return out;
  },
} satisfies ExportedHandler<Env>;
