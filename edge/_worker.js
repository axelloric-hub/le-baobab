const ORIGIN_PREFIXES = ["/api/", "/admin/", "/static/", "/health/", "/ready/"];
const STRIP = ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-internal-timestamp", "x-internal-signature", "x-edge-secret"];
function hardened(request) {
  const headers = new Headers(request.headers);
  for (const h of STRIP) headers.delete(h);
  const incoming = request.headers.get("x-request-id") ?? "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(incoming)) headers.set("x-request-id", crypto.randomUUID().replaceAll("-", ""));
  return new Request(request, { headers });
}
function toOrigin(request, env) {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set("x-edge-secret", env.EDGE_SHARED_SECRET);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", env.PUBLIC_HOST);
  return new Request(new URL(url.pathname + url.search, env.ORIGIN_URL), new Request(request, { headers }));
}
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const req = hardened(request);
    const requestId = req.headers.get("x-request-id");
    if (url.pathname.startsWith("/internal/")) return new Response("Not found", { status: 404 });
    const toDjango = url.pathname === "/ws" || url.pathname.startsWith("/ws/") || url.pathname === "/admin" || ORIGIN_PREFIXES.some((p) => url.pathname.startsWith(p));
    if (toDjango) {
      try {
        const response2 = await fetch(toOrigin(req, env));
        if (response2.status === 101) return response2;
        const out2 = new Response(response2.body, response2);
        out2.headers.set("x-request-id", requestId);
        return out2;
      } catch {
        return Response.json({ error: { code: "origin_unavailable", message: "Le serveur demarre, reessayez dans une minute." } }, { status: 503, headers: { "retry-after": "30", "x-request-id": requestId } });
      }
    }
    const upstream = new URL(url.pathname + url.search, env.FRONTEND_ORIGIN);
    const response = await fetch(new Request(upstream, req));
    const out = new Response(response.body, response);
    out.headers.set("x-request-id", requestId);
    return out;
  }
};
export {
  index_default as default
};
