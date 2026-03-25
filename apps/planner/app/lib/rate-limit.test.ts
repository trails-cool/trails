import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit.ts";

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    const result = checkRateLimit("test-allow", { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding limit", () => {
    const key = "test-block";
    const opts = { maxRequests: 3, windowMs: 60000 };

    checkRateLimit(key, opts); // 1
    checkRateLimit(key, opts); // 2
    checkRateLimit(key, opts); // 3

    const result = checkRateLimit(key, opts); // 4 — over limit
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses separate counters per key", () => {
    const opts = { maxRequests: 1, windowMs: 60000 };

    const a = checkRateLimit("key-a", opts);
    const b = checkRateLimit("key-b", opts);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
