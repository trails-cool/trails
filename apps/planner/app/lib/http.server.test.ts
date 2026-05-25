import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "./http.server.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchWithTimeout (planner)", () => {
  it("aborts when the upstream exceeds the timeout", async () => {
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;
    await expect(fetchWithTimeout("https://example.test", {}, 25)).rejects.toThrow();
  });

  it("returns the response when the call resolves in time", async () => {
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    const resp = await fetchWithTimeout("https://example.test", {}, 1000);
    expect(resp.status).toBe(200);
  });
});
