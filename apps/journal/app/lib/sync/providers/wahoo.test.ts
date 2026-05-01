import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { wahooProvider } from "./wahoo";
import { PushError, OAuthError } from "../types.ts";

const fixturePath = resolve(__dirname, "__fixtures__/wahoo-ride.fit");
const fitBuffer = readFileSync(fixturePath);

describe("wahooProvider.convertToGpx", () => {
  it("converts a FIT file to valid GPX with correct coordinates", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));

    expect(gpx).not.toBeNull();
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("<trkpt");
  });

  it("produces coordinates in valid lat/lon range (not semicircles)", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));
    expect(gpx).not.toBeNull();

    const latMatches = gpx!.matchAll(/lat="([^"]+)"/g);
    const lonMatches = gpx!.matchAll(/lon="([^"]+)"/g);

    const lats = [...latMatches].map((m) => parseFloat(m[1]!));
    const lons = [...lonMatches].map((m) => parseFloat(m[1]!));

    expect(lats.length).toBeGreaterThan(10);
    expect(lons.length).toBeGreaterThan(10);

    for (const lat of lats) {
      expect(lat).toBeGreaterThan(-90);
      expect(lat).toBeLessThan(90);
      // Should be real-world coords, not near-zero from double-conversion
      expect(Math.abs(lat)).toBeGreaterThan(1);
    }
    for (const lon of lons) {
      expect(lon).toBeGreaterThan(-180);
      expect(lon).toBeLessThan(180);
    }
  });

  it("includes ISO 8601 timestamps (not Date objects)", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));
    expect(gpx).not.toBeNull();

    const timeMatches = gpx!.matchAll(/<time>([^<]+)<\/time>/g);
    const times = [...timeMatches].map((m) => m[1]!);

    expect(times.length).toBeGreaterThan(10);
    for (const t of times) {
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(t).toString()).not.toBe("Invalid Date");
    }
  });

  it("includes elevation data", async () => {
    const gpx = await wahooProvider.convertToGpx(Buffer.from(fitBuffer));
    expect(gpx).not.toBeNull();
    expect(gpx).toContain("<ele>");
  });
});

describe("wahooProvider.pushRoute", () => {
  const tokens = {
    accessToken: "test-token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600_000),
  };
  const fit = new Uint8Array([0x01, 0x02, 0x03]);
  const basePayload = {
    fit,
    externalId: "route:abc:v1",
    providerUpdatedAt: new Date("2026-04-30T12:00:00Z"),
    name: "Test route",
    description: "A test",
    startLat: 52.52,
    startLng: 13.405,
    distance: 12345,
    ascent: 200,
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a base64 FIT and returns the remote id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 9876 }),
    });

    const result = await wahooProvider.pushRoute!(tokens, basePayload);

    expect(result.remoteId).toBe("9876");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.wahooligan.com/v1/routes");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("route[external_id]")).toBe("route:abc:v1");
    expect(body.get("route[name]")).toBe("Test route");
    expect(body.get("route[description]")).toBe("A test");
    expect(body.get("route[start_lat]")).toBe("52.52");
    expect(body.get("route[file]")).toBe(
      `data:application/vnd.fit;base64,${Buffer.from(fit).toString("base64")}`,
    );
  });

  it.each([
    [401, "token_expired"],
    [403, "scope_missing"],
    [404, "not_found"],
    [422, "validation"],
    [429, "rate_limit"],
    [500, "generic"],
  ])("maps HTTP %i to PushError code %s", async (status, code) => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => "boom",
    });

    await expect(wahooProvider.pushRoute!(tokens, basePayload)).rejects.toMatchObject({
      name: "PushError",
      code,
      status,
    });
  });

  it("throws generic PushError when response lacks an id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await expect(wahooProvider.pushRoute!(tokens, basePayload)).rejects.toBeInstanceOf(PushError);
  });
});

describe("wahooProvider.updateRoute", () => {
  const tokens = {
    accessToken: "test-token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600_000),
  };
  const fit = new Uint8Array([0x01, 0x02, 0x03]);
  const basePayload = {
    fit,
    externalId: "route:abc",
    providerUpdatedAt: new Date("2026-04-30T12:00:00Z"),
    name: "Test route",
    description: "A test",
    startLat: 52.52,
    startLng: 13.405,
    distance: 12345,
    ascent: 200,
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs to /v1/routes/:id and keeps the same remote id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 9876 }),
    });

    const result = await wahooProvider.updateRoute!(tokens, "9876", basePayload);

    expect(result.remoteId).toBe("9876");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.wahooligan.com/v1/routes/9876");
    expect(init.method).toBe("PUT");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("route[external_id]")).toBe("route:abc");
    expect(body.get("route[file]")).toBe(
      `data:application/vnd.fit;base64,${Buffer.from(fit).toString("base64")}`,
    );
  });

  it("falls back to the targeted remote id when PUT returns 204 (no body)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => null,
    });
    const result = await wahooProvider.updateRoute!(tokens, "555", basePayload);
    expect(result.remoteId).toBe("555");
  });

  it("throws PushError(not_found) on 404 so the pipeline can fall back to POST", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "gone",
    });
    await expect(wahooProvider.updateRoute!(tokens, "missing", basePayload)).rejects.toMatchObject({
      name: "PushError",
      code: "not_found",
      status: 404,
    });
  });
});

describe("wahooProvider.exchangeCode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Wahoo's 'too many unrevoked access tokens' 400 to OAuthError(too_many_tokens)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        '{"error":"Too many unrevoked access tokens exist for this app and user. ..."}',
    });
    await expect(wahooProvider.exchangeCode("code", "https://x/cb")).rejects.toMatchObject({
      name: "OAuthError",
      code: "too_many_tokens",
      status: 400,
    });
  });
});

describe("wahooProvider.revoke", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DELETEs /v1/permissions with the bearer token", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" });
    await wahooProvider.revoke!({
      accessToken: "tok",
      refreshToken: "r",
      expiresAt: new Date(),
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.wahooligan.com/v1/permissions");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("throws on non-OK response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => "bad" });
    await expect(
      wahooProvider.revoke!({ accessToken: "tok", refreshToken: "r", expiresAt: new Date() }),
    ).rejects.toThrow();
    // Reference OAuthError to keep the import used even if future tests trim above blocks.
    expect(OAuthError).toBeDefined();
  });
});
