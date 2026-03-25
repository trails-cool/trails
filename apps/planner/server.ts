import * as Sentry from "@sentry/node";
import { createRequestListener } from "@react-router/node";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { setupYjsWebSocket } from "./app/lib/yjs-server.ts";

Sentry.init({
  dsn: "https://5215134cd78d5e6c199e29300b8425af@o4509530546634752.ingest.de.sentry.io/4511102546608208",
  release: process.env.SENTRY_RELEASE,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
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

const server = createServer((req, res) => {
  if (!serveStatic(req, res)) {
    listener(req, res);
  }
});

setupYjsWebSocket(server);

server.listen(port, () => {
  console.log(`Planner server listening on http://localhost:${port}`);
  console.log(`Yjs WebSocket available at ws://localhost:${port}/sync/:sessionId`);
});
