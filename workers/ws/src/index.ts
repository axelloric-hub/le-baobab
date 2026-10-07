import { Container, getRandom } from "@cloudflare/containers";
import { containerEnv, proxied, type BackendEnv } from "../../shared/container-env";

interface Env extends BackendEnv {
  WS: DurableObjectNamespace<WsContainer>;
  WS_INSTANCES?: string;
}

/** Django Channels (ASGI). Tous les echanges passent par le channel layer Redis : n'importe quelle instance convient. */
export class WsContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "30m";

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = containerEnv(env, "ws");
  }

  override onError(error: unknown): void {
    console.error("ws container error", error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/ws/")) return new Response("Not found", { status: 404 });
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    const container = await getRandom(env.WS, Number(env.WS_INSTANCES ?? "2"));
    return container.fetch(proxied(request, env.PUBLIC_HOST));
  },
} satisfies ExportedHandler<Env>;
