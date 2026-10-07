import { Container, getContainer, getRandom } from "@cloudflare/containers";
import { containerEnv, proxied, type BackendEnv } from "../../shared/container-env";

interface Env extends BackendEnv {
  API: DurableObjectNamespace<ApiContainer>;
}

/** Django REST Framework (gunicorn + uvicorn) : instances interchangeables, sans etat. */
export class ApiContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "15m";

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = containerEnv(env, "api");
  }

  override onError(error: unknown): void {
    console.error("api container error", error);
  }
}

// Cron trigger (expression exacte de wrangler.api.jsonc) -> jobs Django declares dans apps/core/internal.py
const CRON_JOBS: Record<string, string[]> = {
  "* * * * *": ["relay-outbox", "flush-counters"],
  "*/10 * * * *": ["refresh-trending"],
  "0 * * * *": ["housekeeping", "refresh-metrics"],
};

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function runJob(env: Env, name: string): Promise<void> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacHex(env.INTERNAL_JOB_SECRET, `${ts}.${name}`);
  // Instance DEDIEE "cron" : les instances qui servent les requetes utilisateur peuvent se mettre en veille.
  const container = getContainer(env.API, "cron");
  const request = proxied(
    new Request(`http://container/internal/jobs/${name}/`, {
      method: "POST",
      headers: { "x-internal-timestamp": ts, "x-internal-signature": signature },
    }),
    env.PUBLIC_HOST,
  );
  const response = await container.fetch(request);
  if (!response.ok) throw new Error(`job ${name} -> HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    // /internal/* n'est jamais joignable depuis l'exterieur (seul le cron l'appelle, directement sur le conteneur).
    if (pathname.startsWith("/internal/")) return new Response("Not found", { status: 404 });
    const instances = Number(env.API_INSTANCES ?? "3");
    const container = await getRandom(env.API, instances);
    return container.fetch(proxied(request, env.PUBLIC_HOST));
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const jobs = CRON_JOBS[controller.cron] ?? [];
    ctx.waitUntil(
      (async () => {
        for (const job of jobs) {
          try {
            await runJob(env, job);
          } catch (error) {
            console.error(`cron job failed: ${job}`, error); // visible dans les logs Workers -> Grafana/Logpush
          }
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
