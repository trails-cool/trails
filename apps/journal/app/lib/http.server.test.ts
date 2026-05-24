import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "./http.server.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchWithTimeout", () => {
  it("aborts when the request exceeds the timeout", async () => {
    // Mock fetch to honor the AbortSignal but never resolve otherwise.
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;

    await expect(fetchWithTimeout("https://example.test", {}, 25)).rejects.toThrow();
  });

  it("forwards the response when the call returns in time", async () => {
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;
    const resp = await fetchWithTimeout("https://example.test", {}, 1000);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe("ok");
  });

  it("respects a caller-supplied abort signal alongside the timeout", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;
    const p = fetchWithTimeout("https://example.test", { signal: controller.signal }, 60_000);
    controller.abort();
    await expect(p).rejects.toThrow();
  });
});
