import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveStatic } from "./serve-static.ts";

function mockReq(url: string, method = "GET"): IncomingMessage {
  return { url, method, headers: { host: "trails.cool" } } as unknown as IncomingMessage;
}

function mockRes(): ServerResponse {
  return { setHeader: vi.fn() } as unknown as ServerResponse;
}

describe("serveStatic", () => {
  // Regression: a malformed path makes `new URL` throw ERR_INVALID_URL.
  // Because serveStatic runs synchronously inside the HTTP server
  // callback, an unhandled throw is process-fatal — a single `GET //`
  // crash-looped the journal in prod. It must fall through (return false)
  // so the request reaches React Router and 404s instead.
  it.each(["//", "///", "/\\", "//foo\\bar"])(
    "returns false without throwing for malformed path %j",
    (path) => {
      const req = mockReq(path);
      expect(() => serveStatic(req, mockRes())).not.toThrow();
      expect(serveStatic(req, mockRes())).toBe(false);
    },
  );

  it("falls through for non-GET/HEAD methods", () => {
    expect(serveStatic(mockReq("/assets/app.js", "POST"), mockRes())).toBe(false);
  });

  it("falls through for a well-formed path with no matching file", () => {
    expect(serveStatic(mockReq("/does/not/exist.js"), mockRes())).toBe(false);
  });
});
