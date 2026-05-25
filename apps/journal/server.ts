import * as Sentry from "@sentry/node";
import { nodeSentryConfig, drop404s } from "@trails-cool/sentry-config";
import { createRequestListener } from "@react-router/node";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { logger, requestContext } from "./app/lib/logger.server.ts";
import { randomUUID } from "node:crypto";
import { httpRequestDuration, registry } from "./app/lib/metrics.server.ts";
import { createBoss, startWorker } from "@trails-cool/jobs";
import { getDatabaseUrl } from "@trails-cool/db";
import postgres, { type Sql } from "postgres";

// Sentry DSN is supplied via env. No hardcoded fallback — self-hosted
// instances default to no Sentry. Flagship sets SENTRY_DSN via
// docker-compose env (see infrastructure/docker-compose.yml).
// SENTRY_DISABLED=true is an explicit opt-out even when a DSN is set
// (useful for local prod-mode debugging).
const sentryDsn = process.env.SENTRY_DSN;
if (process.env.SENTRY_DISABLED !== "true" && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    ...nodeSentryConfig("journal server"),
    beforeSend: drop404s,
  });
}

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

// Module-level singleton postgres client dedicated to /api/health. The
// previous handler opened a fresh client + connection on every call,
// which OOM'd the process under monitoring load (probes hit /api/health
// every few seconds). `max: 2` is plenty for liveness checks; the main
// app DB pool is separate (via @trails-cool/db's createDb).
let healthClient: Sql | null = null;
function getHealthClient(): Sql {
  if (!healthClient) {
    healthClient = postgres(getDatabaseUrl(), { max: 2, idle_timeout: 30 });
  }
  return healthClient;
}

async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await getHealthClient()`SELECT 1`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version, db: "connected" }));
  } catch {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "degraded", version, db: "unreachable" }));
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const start = Date.now();

  // Honor an inbound X-Request-Id header (e.g. from Caddy or a probe)
  // so request IDs propagate across the proxy hop. Mint a fresh one if
  // absent. Echo on the response so clients can correlate.
  const inbound = req.headers["x-request-id"];
  const requestId =
    (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();
  res.setHeader("X-Request-Id", requestId);

  requestContext.run({ requestId }, () => {
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
});

server.listen(port, async () => {
  logger.info({ port }, "Journal server listening");

  // Seed first-party OAuth2 clients
  const { seedOAuthClient } = await import("./app/lib/oauth.server.ts");
  await seedOAuthClient("trails-cool-mobile", "trailscool://auth/callback", true);

  // Pre-flight the demo user so a persona username that clashes with a
  // real account blocks job scheduling rather than silently attaching
  // synthetic rows to a human.
  let enableDemoJobs = false;
  if (process.env.DEMO_BOT_ENABLED === "true") {
    const { ensureDemoUser, DemoPersonaUsernameClashError } = await import(
      "./app/lib/demo-bot.server.ts"
    );
    try {
      const id = await ensureDemoUser();
      logger.info({ id }, "demo-bot user ensured");
      enableDemoJobs = true;
    } catch (err) {
      if (err instanceof DemoPersonaUsernameClashError) {
        logger.error(
          { username: err.username },
          "demo persona username clash — demo jobs disabled for this process",
        );
      } else {
        logger.error({ err }, "demo-bot ensureDemoUser failed");
      }
    }
  }

  // Start background job worker
  const jobs: Parameters<typeof startWorker>[1] = [];
  if (enableDemoJobs) {
    const { demoBotGenerateJob } = await import("./app/jobs/demo-bot-generate.ts");
    const { demoBotPruneJob } = await import("./app/jobs/demo-bot-prune.ts");
    jobs.push(demoBotGenerateJob, demoBotPruneJob);
  }
  // Notifications jobs always run (no feature flag): a journal without
  // notifications wired up would silently drop fan-out enqueues.
  const { notificationsFanoutJob } = await import("./app/jobs/notifications-fanout.ts");
  const { notificationsPurgeJob } = await import("./app/jobs/notifications-purge.ts");
  const { komootBulkImportJob } = await import("./app/jobs/komoot-bulk-import.ts");
  const { importBatchesSweepJob } = await import("./app/jobs/import-batches-sweep.ts");
  const { sendWelcomeEmailJob } = await import("./app/jobs/send-welcome-email.ts");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs.push(notificationsFanoutJob, notificationsPurgeJob, komootBulkImportJob as any, importBatchesSweepJob, sendWelcomeEmailJob);

  const boss = createBoss(getDatabaseUrl());
  await startWorker(boss, jobs);
  // Register the started boss so feature code can enqueue jobs against
  // the same instance via getBoss() / enqueueOptional().
  const { setBoss } = await import("./app/lib/boss.server.ts");
  setBoss(boss);
  logger.info("Background job worker started");
});
