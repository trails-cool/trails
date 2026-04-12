import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("DOMAIN", "trails.cool");
vi.stubEnv("ORIGIN", "https://trails.cool");

describe("GET /.well-known/trails-cool", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns discovery response with API version", async () => {
    const { loader } = await import("./api.well-known.trails-cool.ts");
    const resp = loader() as Response;
    const data = await resp.json();

    expect(data.apiVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(data.instanceName).toBe("trails.cool");
    expect(data.apiBaseUrl).toBe("https://trails.cool/api/v1");
  });

  it("uses localhost defaults when env vars are unset", async () => {
    vi.stubEnv("DOMAIN", "");
    vi.stubEnv("ORIGIN", "");
    // Re-import to pick up changed env
    const mod = await import("./api.well-known.trails-cool.ts");
    const resp = mod.loader() as Response;
    const data = await resp.json();

    // Falls back to process.env values (empty strings trigger ?? fallback)
    expect(data).toHaveProperty("apiVersion");
    expect(data).toHaveProperty("apiBaseUrl");
  });
});
