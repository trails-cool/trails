// Contract tests for the Wahoo RoutePusher capability adapter.
//
// Seam: pushRoute(ctx, input) -> {remoteId, version}
//
// Wahoo workarounds (FIT conversion, route:<id> external_id, PUT-vs-POST,
// PUT->POST-on-404 fallback) are tested here as adapter-internal — they
// must not surface on the seam.

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CapabilityContext } from "../../registry.ts";
import type { OAuthCredentials } from "../../types.ts";

// ---- mocks ----

const fetchSpy = vi.fn();

const mockFitConvert = vi.fn();
vi.mock("@trails-cool/fit", () => ({
  gpxToFitCourse: (input: unknown) => mockFitConvert(input),
}));

// sync_pushes idempotency state — manipulated per-test.
let existingPushRow:
  | {
      id: string;
      userId: string;
      routeId: string;
      provider: string;
      remoteId: string | null;
      lastPushedVersion: number | null;
      pushedAt: Date | null;
      error: string | null;
    }
  | null = null;
const insertedPushes: unknown[] = [];
const updatedPushes: unknown[] = [];

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(existingPushRow ? [existingPushRow] : []),
      }),
    }),
  }),
  insert: () => ({
    values: (v: unknown) => {
      insertedPushes.push(v);
      return Promise.resolve();
    },
  }),
  update: () => ({
    set: (patch: unknown) => ({
      where: () => {
        updatedPushes.push(patch);
        return Promise.resolve();
      },
    }),
  }),
};

vi.mock("../../../db.ts", () => ({ getDb: () => mockDb }));

vi.mock("../../manager.ts", () => ({
  getServiceById: async () => ({
    id: "svc-1",
    userId: "u1",
    provider: "wahoo",
    credentialKind: "oauth",
    credentials: {},
    status: "active",
    providerUserId: null,
    grantedScopes: [],
    createdAt: new Date(),
  }),
}));

beforeEach(() => {
  fetchSpy.mockReset();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  mockFitConvert.mockReset();
  mockFitConvert.mockResolvedValue(new Uint8Array([0xfe, 0xed, 0xfa, 0xce]));
  existingPushRow = null;
  insertedPushes.length = 0;
  updatedPushes.length = 0;
});

const stubCreds: OAuthCredentials = {
  access_token: "fake-token",
  refresh_token: "rt",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

function ctx(): CapabilityContext {
  return {
    serviceId: "svc-1",
    withFreshCredentials: async (fn) => fn(stubCreds),
  };
}

const pushInput = {
  routeId: "route-abc",
  routeName: "Berlin loop",
  description: "morning ride",
  gpx: `<?xml version="1.0"?><gpx><trk><trkseg>
    <trkpt lat="52.5" lon="13.4"><ele>34</ele></trkpt>
    <trkpt lat="52.6" lon="13.5"><ele>40</ele></trkpt>
  </trkseg></trk></gpx>`,
  startLat: 52.5,
  startLng: 13.4,
  distance: 1234,
  ascent: 56,
  localVersion: 3,
};

const { wahooPusher } = await import("./pusher.ts");

describe("wahooPusher.pushRoute — first push (no existing row)", () => {
  it("POSTs to /v1/routes with FIT body and external_id=route:<routeId>", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 9001 }), { status: 201 }),
    );

    const result = await wahooPusher.pushRoute(ctx(), pushInput);

    expect(result.remoteId).toBe("9001");
    expect(result.version).toBe(3);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.wahooligan.com/v1/routes");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as string;
    expect(body).toContain("route%5Bexternal_id%5D=route%3Aroute-abc");
    expect(body).toContain("route%5Bfile%5D=data%3Aapplication%2Fvnd.fit%3Bbase64%2C");
    expect(insertedPushes).toHaveLength(1);
  });
});

describe("wahooPusher.pushRoute — re-push of an unchanged route", () => {
  it("short-circuits without calling Wahoo when last_pushed_version matches", async () => {
    existingPushRow = {
      id: "existing",
      userId: "u1",
      routeId: "route-abc",
      provider: "wahoo",
      remoteId: "9001",
      lastPushedVersion: 3,
      pushedAt: new Date("2026-01-01"),
      error: null,
    };

    const result = await wahooPusher.pushRoute(ctx(), pushInput);

    expect(result.remoteId).toBe("9001");
    expect(result.version).toBe(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("wahooPusher.pushRoute — re-push after edit", () => {
  it("PUTs to /v1/routes/<remoteId> when lastPushedVersion < localVersion", async () => {
    existingPushRow = {
      id: "existing",
      userId: "u1",
      routeId: "route-abc",
      provider: "wahoo",
      remoteId: "9001",
      lastPushedVersion: 2,
      pushedAt: new Date("2026-01-01"),
      error: null,
    };
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await wahooPusher.pushRoute(ctx(), pushInput);

    expect(result.remoteId).toBe("9001");
    expect(result.version).toBe(3);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.wahooligan.com/v1/routes/9001");
    expect((init as RequestInit).method).toBe("PUT");
  });
});

describe("wahooPusher.pushRoute — PUT 404 fallback", () => {
  it("falls back to POST and overwrites remoteId when PUT returns 404", async () => {
    existingPushRow = {
      id: "existing",
      userId: "u1",
      routeId: "route-abc",
      provider: "wahoo",
      remoteId: "9001",
      lastPushedVersion: 2,
      pushedAt: new Date("2026-01-01"),
      error: null,
    };
    fetchSpy
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9999 }), { status: 201 }),
      );

    const result = await wahooPusher.pushRoute(ctx(), pushInput);

    expect(result.remoteId).toBe("9999");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchSpy.mock.calls[1]!;
    expect((secondInit as RequestInit).method).toBe("POST");
  });
});
