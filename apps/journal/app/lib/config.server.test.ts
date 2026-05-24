import { describe, it, expect, vi, beforeEach } from "vitest";

describe("getOrigin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns ORIGIN env when set", async () => {
    vi.stubEnv("ORIGIN", "https://example.com");
    const { getOrigin } = await import("./config.server.ts");
    expect(getOrigin()).toBe("https://example.com");
  });

  it("falls back to localhost when unset", async () => {
    delete process.env.ORIGIN;
    const { getOrigin } = await import("./config.server.ts");
    expect(getOrigin()).toBe("http://localhost:3000");
  });
});
