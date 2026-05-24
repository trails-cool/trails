import { describe, it, expect, beforeEach } from "vitest";
import { consumeRateLimit, clientIp, _resetRateLimitsForTest } from "./rate-limit.server.ts";

describe("consumeRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitsForTest();
  });

  it("allows up to `limit` calls in the window, blocks the (limit+1)th", () => {
    for (let i = 0; i < 5; i++) {
      const r = consumeRateLimit({ scope: "t", key: "a", limit: 5, windowMs: 60_000 });
      expect(r.allowed).toBe(true);
    }
    const blocked = consumeRateLimit({ scope: "t", key: "a", limit: 5, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts buckets independently per (scope, key) pair", () => {
    for (let i = 0; i < 5; i++) {
      consumeRateLimit({ scope: "t", key: "a", limit: 5, windowMs: 60_000 });
    }
    // Different key → unaffected
    expect(
      consumeRateLimit({ scope: "t", key: "b", limit: 5, windowMs: 60_000 }).allowed,
    ).toBe(true);
    // Different scope, same key → unaffected
    expect(
      consumeRateLimit({ scope: "u", key: "a", limit: 5, windowMs: 60_000 }).allowed,
    ).toBe(true);
  });

  it("decrements `remaining` toward zero", () => {
    const a = consumeRateLimit({ scope: "t", key: "k", limit: 3, windowMs: 60_000 });
    const b = consumeRateLimit({ scope: "t", key: "k", limit: 3, windowMs: 60_000 });
    const c = consumeRateLimit({ scope: "t", key: "k", limit: 3, windowMs: 60_000 });
    expect([a.remaining, b.remaining, c.remaining]).toEqual([2, 1, 0]);
  });

  it("reports a reset window roughly equal to the configured window on first call", () => {
    const r = consumeRateLimit({ scope: "t", key: "k", limit: 1, windowMs: 60_000 });
    expect(r.resetMs).toBe(60_000);
  });
});

describe("clientIp", () => {
  it("uses the first entry from X-Forwarded-For", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to a stable 'unknown' bucket when no header is set", () => {
    const req = new Request("http://x/");
    expect(clientIp(req)).toBe("unknown");
  });

  it("trims whitespace from the parsed IP", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "  198.51.100.7  , 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("198.51.100.7");
  });
});
