import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

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

/**
 * Serve a static asset from the client build. Returns true if the request
 * was handled, false if it should fall through to the app request handler.
 *
 * Runs synchronously inside the HTTP server callback, so it must never
 * throw: a thrown error here is an uncaught exception that crashes the
 * whole process. Malformed request paths (e.g. `//`, `///`, `/\`) make
 * `new URL` throw `ERR_INVALID_URL`; we catch that and fall through so
 * React Router 404s the request instead of taking the server down.
 */
export function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  let url: URL;
  try {
    url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  } catch {
    return false;
  }
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
