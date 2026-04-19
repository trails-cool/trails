import * as Sentry from "@sentry/node";
import { nodeSentryConfig, drop404s } from "@trails-cool/sentry-config";
import { createRequestListener } from "@react-router/node";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { logger } from "./app/lib/logger.server.ts";
import { httpRequestDuration, registry } from "./app/lib/metrics.server.ts";
import { createBoss, startWorker } from "@trails-cool/jobs";
import postgres from "postgres";

Sentry.init({
  dsn: "https://a32ffcc575d34be072e91b20f247eeee@o4509530546634752.ingest.de.sentry.io/4509530555547728",
  ...nodeSentryConfig("journal server"),
  beforeSend: drop404s,
});

const port = Number(process.env.PORT ?? 3000);
const CLIENT_DIR = resolve(import.meta.dirname, "build", "client");

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const filePath = resolve(join(CLIENT_DIR, url.pathname));

  if (!filePath.startsWith(CLIENT_DIR)) return false;

  try {
    if (!statSync(filePath).isFile()) return false;
  } catch {
    return false;
  }

  res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream");
  if (url.pathname.startsWith("/assets/")) {
    res.setHeader("Cache-Control", "public, immutable, max-age=31536000");
  }
  createReadStream(filePath).pipe(res);
  return true;
}

const listener = createRequestListener({
  build: () => import("./build/server/index.js" as string) as never,
});

async function handleMetrics(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const metrics = await registry.metrics();
  res.writeHead(200, { "Content-Type": registry.contentType });
  res.end(metrics);
}

const version = process.env.SENTRY_RELEASE ?? "dev";

async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const client = postgres(process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails", { max: 1 });
  try {
    await client`SELECT 1`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version, db: "connected" }));
  } catch {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "degraded", version, db: "unreachable" }));
  } finally {
    await client.end();
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const start = Date.now();

  if (!url.startsWith("/assets/") && url !== "/api/health" && url !== "/api/metrics") {
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info({ method: req.method, path: url, status: res.statusCode, duration }, "request");
      httpRequestDuration.observe(
        { method: req.method ?? "GET", route: url.split("?")[0]!, status: String(res.statusCode) },
        duration / 1000,
      );
    });
  }

  if (url === "/api/health") { handleHealth(req, res); return; }
  if (url === "/api/metrics") { handleMetrics(req, res); return; }
  if (!serveStatic(req, res)) {
    listener(req, res);
  }
});

server.listen(port, async () => {
  logger.info({ port }, "Journal server listening");

  // Seed first-party OAuth2 clients
  const { seedOAuthClient } = await import("./app/lib/oauth.server.ts");
  await seedOAuthClient("trails-cool-mobile", "trailscool://auth/callback", true);

  // Start background job worker
  const { demoBotGenerateJob } = await import("./app/jobs/demo-bot-generate.ts");
  const { demoBotPruneJob } = await import("./app/jobs/demo-bot-prune.ts");
  const boss = createBoss(process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails");
  await startWorker(boss, [demoBotGenerateJob, demoBotPruneJob]);
  logger.info("Background job worker started");

  // Bootstrap the demo user when the bot is enabled; cheap idempotent insert.
  if (process.env.DEMO_BOT_ENABLED === "true") {
    const { ensureDemoUser } = await import("./app/lib/demo-bot.server.ts");
    try {
      const id = await ensureDemoUser();
      logger.info({ id }, "demo-bot user ensured");
    } catch (err) {
      logger.error({ err }, "demo-bot ensureDemoUser failed");
    }
  }
});
