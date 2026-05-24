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

describe("requireSecret", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns the env value when set in any environment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MY_SECRET", "real-secret");
    const { requireSecret } = await import("./config.server.ts");
    expect(requireSecret("MY_SECRET", "dev-fallback")).toBe("real-secret");
  });

  it("returns the dev fallback when unset in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.MY_SECRET;
    const { requireSecret } = await import("./config.server.ts");
    expect(requireSecret("MY_SECRET", "dev-fallback")).toBe("dev-fallback");
  });

  it("throws in production when the secret is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.MY_SECRET;
    const { requireSecret } = await import("./config.server.ts");
    expect(() => requireSecret("MY_SECRET", "dev-fallback")).toThrow(/MY_SECRET/);
  });

  it("throws in production when the secret matches the dev fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MY_SECRET", "dev-fallback");
    const { requireSecret } = await import("./config.server.ts");
    expect(() => requireSecret("MY_SECRET", "dev-fallback")).toThrow(/dev fallback/);
  });
});
