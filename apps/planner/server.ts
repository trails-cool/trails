import * as Sentry from "@sentry/node";
import { logger } from "./app/lib/logger.server.ts";
import { httpRequestDuration } from "./app/lib/metrics.server.ts";
import { createRequestListener } from "@react-router/node";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { setupYjsWebSocket } from "./app/lib/yjs-server.ts";

const sentryEnvironment = process.env.CI ? "ci" : (process.env.NODE_ENV ?? "development");

Sentry.init({
  dsn: "https://5215134cd78d5e6c199e29300b8425af@o4509530546634752.ingest.de.sentry.io/4511102546608208",
  release: process.env.SENTRY_RELEASE,
  environment: sentryEnvironment,
  tracesSampleRate: 1.0,
  enabled: process.env.NODE_ENV === "production" && !process.env.CI,
  beforeSend(event) {
    const serialized = event.extra?.__serialized__ as Record<string, unknown> | undefined;
    if (serialized?.status === 404) return null;
    return event;
  },
});

const port = Number(process.env.PORT ?? 3001);
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
  build: () => import("./build/server/index.js") as never,
});

async function handleMetrics(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { registry } = await import("./app/lib/metrics.server.ts");
  const metrics = await registry.metrics();
  res.writeHead(200, { "Content-Type": registry.contentType });
  res.end(metrics);
}

const version = process.env.SENTRY_RELEASE ?? "dev";

async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const { withDb, db } = await import("@trails-cool/db");
    const { sql } = await import("drizzle-orm");
    await withDb(async () => { await db.execute(sql`SELECT 1`); });
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

  // Log and track request on finish (skip static assets and health/metrics)
  if (!url.startsWith("/assets/") && url !== "/health" && url !== "/metrics") {
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info({ method: req.method, path: url, status: res.statusCode, duration }, "request");
      httpRequestDuration.observe(
        { method: req.method ?? "GET", route: url.split("?")[0]!, status: String(res.statusCode) },
        duration / 1000,
      );
    });
  }

  if (url === "/health") { handleHealth(req, res); return; }
  if (url === "/metrics") { handleMetrics(req, res); return; }
  if (!serveStatic(req, res)) {
    listener(req, res);
  }
});

setupYjsWebSocket(server);

server.listen(port, () => {
  logger.info({ port }, "Planner server listening");
  logger.info({ port, path: "/sync/:sessionId" }, "Yjs WebSocket available");
});
