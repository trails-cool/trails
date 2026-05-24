import { describe, it, expect, vi, beforeEach } from "vitest";

const DEV = "postgres://trails:trails@localhost:5432/trails";

describe("getDatabaseUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses the override argument when provided", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getDatabaseUrl } = await import("./index.ts");
    expect(getDatabaseUrl("postgres://override/db")).toBe("postgres://override/db");
  });

  it("returns DATABASE_URL when set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://real-prod/db");
    const { getDatabaseUrl } = await import("./index.ts");
    expect(getDatabaseUrl()).toBe("postgres://real-prod/db");
  });

  it("falls back to the dev URL in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.DATABASE_URL;
    const { getDatabaseUrl } = await import("./index.ts");
    expect(getDatabaseUrl()).toBe(DEV);
  });

  it("throws in production when DATABASE_URL is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;
    const { getDatabaseUrl } = await import("./index.ts");
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL/);
  });

  it("throws in production when DATABASE_URL matches the dev default", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", DEV);
    const { getDatabaseUrl } = await import("./index.ts");
    expect(() => getDatabaseUrl()).toThrow(/dev default/);
  });
});
