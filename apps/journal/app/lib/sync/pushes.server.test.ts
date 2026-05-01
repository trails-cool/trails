import { describe, it, expect, vi, beforeEach } from "vitest";

const SHORT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="52.5200" lon="13.4050"><ele>34.0</ele></trkpt>
    <trkpt lat="52.5210" lon="13.4060"><ele>34.5</ele></trkpt>
    <trkpt lat="52.5220" lon="13.4070"><ele>35.0</ele></trkpt>
  </trkseg></trk>
</gpx>`;

const mockGetRoute = vi.fn();
const mockGetConnection = vi.fn();
const mockUpdateTokens = vi.fn();
const mockGetProvider = vi.fn();

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../db.ts", () => ({
  getDb: () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }),
}));
vi.mock("../routes.server.ts", () => ({ getRoute: mockGetRoute }));
vi.mock("./connections.server.ts", () => ({
  getConnection: mockGetConnection,
  updateTokens: mockUpdateTokens,
}));
vi.mock("./registry.ts", () => ({ getProvider: mockGetProvider }));

// Each call to db.select returns a chainable thenable resolving to the next
// queued result. The pipeline does two selects: routeVersions, sync_pushes.
function queueSelectResults(...results: unknown[][]) {
  for (const r of results) {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(r),
          }),
          limit: () => Promise.resolve(r),
        }),
      }),
    });
  }
}

function chainNoop() {
  return {
    values: () => Promise.resolve(),
    set: () => ({ where: () => Promise.resolve() }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockImplementation(() => chainNoop());
  mockUpdate.mockImplementation(() => chainNoop());
});

async function importPipeline() {
  const mod = await import("./pushes.server.ts");
  return mod;
}

const baseRoute = {
  id: "r1",
  ownerId: "u1",
  name: "Test route",
  description: "A test",
  gpx: SHORT_GPX,
};
const baseConnection = {
  id: "c1",
  userId: "u1",
  provider: "wahoo",
  accessToken: "tok",
  refreshToken: "ref",
  expiresAt: new Date(Date.now() + 3600_000),
  providerUserId: "42",
  grantedScopes: ["routes_write", "workouts_read"],
};

function makeProvider(over: Record<string, unknown> = {}) {
  return {
    id: "wahoo",
    name: "Wahoo",
    scopes: ["routes_write"],
    pushRoute: vi.fn(),
    updateRoute: vi.fn(),
    refreshToken: vi.fn(),
    ...over,
  };
}

describe("pushRouteToProvider", () => {
  it("performs a fresh push and records sync_pushes", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults([{ version: 2, gpx: SHORT_GPX }], []); // route version, sync_pushes existing

    const provider = makeProvider();
    provider.pushRoute.mockResolvedValue({ remoteId: "wahoo-9" });
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "success", remoteId: "wahoo-9" });
    expect(provider.pushRoute).toHaveBeenCalledOnce();
    const [, payload] = provider.pushRoute.mock.calls[0]!;
    expect(payload.externalId).toBe("route:r1");
    expect(payload.startLat).toBeCloseTo(52.52, 4);
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("short-circuits when the current version is already pushed", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults(
      [{ version: 1, gpx: SHORT_GPX }],
      [{
        id: "p1",
        pushedAt: new Date("2026-04-01T00:00:00Z"),
        remoteId: "wahoo-7",
        lastPushedVersion: 1,
      }],
    );

    const provider = makeProvider();
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "success", remoteId: "wahoo-7" });
    expect(provider.pushRoute).not.toHaveBeenCalled();
    expect(provider.updateRoute).not.toHaveBeenCalled();
  });

  it("PUTs against the existing remote id when the local version has advanced", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults(
      [{ version: 2, gpx: SHORT_GPX }],
      [{
        id: "p1",
        pushedAt: new Date("2026-04-01T00:00:00Z"),
        remoteId: "wahoo-7",
        lastPushedVersion: 1,
      }],
    );

    const provider = makeProvider();
    provider.updateRoute.mockResolvedValue({ remoteId: "wahoo-7" });
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "success", remoteId: "wahoo-7" });
    expect(provider.updateRoute).toHaveBeenCalledOnce();
    expect(provider.pushRoute).not.toHaveBeenCalled();
    // Existing row updated in place — exactly one row exists afterwards.
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("falls back to POST when PUT returns not_found", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults(
      [{ version: 2, gpx: SHORT_GPX }],
      [{
        id: "p1",
        pushedAt: new Date("2026-04-01T00:00:00Z"),
        remoteId: "wahoo-stale",
        lastPushedVersion: 1,
      }],
    );

    const provider = makeProvider();
    const { PushError } = await import("./types.ts");
    provider.updateRoute.mockRejectedValueOnce(new PushError("not_found", "gone", 404));
    provider.pushRoute.mockResolvedValueOnce({ remoteId: "wahoo-fresh" });
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "success", remoteId: "wahoo-fresh" });
    expect(provider.updateRoute).toHaveBeenCalledOnce();
    expect(provider.pushRoute).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("retries a failed prior attempt and updates the existing row", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults(
      [{ version: 1, gpx: SHORT_GPX }],
      [{ id: "p1", pushedAt: null, remoteId: null, error: "generic: boom" }],
    );

    const provider = makeProvider();
    provider.pushRoute.mockResolvedValue({ remoteId: "wahoo-77" });
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "success", remoteId: "wahoo-77" });
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("redirects via scope_missing when grantedScopes lacks routes_write", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue({ ...baseConnection, grantedScopes: ["workouts_read"] });
    mockGetProvider.mockReturnValue(makeProvider());

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toEqual({ status: "scope_missing" });
  });

  it("returns no_connection when no sync_connections row exists", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(null);
    mockGetProvider.mockReturnValue(makeProvider());

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });
    expect(out).toEqual({ status: "no_connection" });
  });

  it("returns not_owner when the requesting user isn't the owner", async () => {
    mockGetRoute.mockResolvedValue({ ...baseRoute, ownerId: "other" });
    mockGetProvider.mockReturnValue(makeProvider());

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });
    expect(out).toEqual({ status: "not_owner" });
  });

  it("refreshes tokens and retries once on token_expired", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults([{ version: 1, gpx: SHORT_GPX }], []);

    const provider = makeProvider();
    const { PushError } = await import("./types.ts");
    provider.pushRoute
      .mockRejectedValueOnce(new PushError("token_expired", "401", 401))
      .mockResolvedValueOnce({ remoteId: "wahoo-after-refresh" });
    provider.refreshToken.mockResolvedValue({
      accessToken: "new-tok",
      refreshToken: "new-ref",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "success", remoteId: "wahoo-after-refresh" });
    expect(provider.refreshToken).toHaveBeenCalledOnce();
    expect(provider.pushRoute).toHaveBeenCalledTimes(2);
    expect(mockUpdateTokens).toHaveBeenCalledWith("c1", expect.objectContaining({ accessToken: "new-tok" }));
  });

  it("records validation errors and surfaces them to the caller", async () => {
    mockGetRoute.mockResolvedValue(baseRoute);
    mockGetConnection.mockResolvedValue(baseConnection);
    queueSelectResults([{ version: 1, gpx: SHORT_GPX }], []);

    const provider = makeProvider();
    const { PushError } = await import("./types.ts");
    provider.pushRoute.mockRejectedValue(new PushError("validation", "bad name", 422));
    mockGetProvider.mockReturnValue(provider);

    const { pushRouteToProvider } = await importPipeline();
    const out = await pushRouteToProvider({ userId: "u1", providerId: "wahoo", routeId: "r1" });

    expect(out).toMatchObject({ status: "error", code: "validation" });
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});

describe("encodeOAuthState / decodeOAuthState", () => {
  it("round-trips a push-after state", async () => {
    const { encodeOAuthState, decodeOAuthState } = await importPipeline();
    const encoded = encodeOAuthState({ pushAfter: { routeId: "abc" }, returnTo: "/routes/abc" });
    expect(decodeOAuthState(encoded)).toEqual({ pushAfter: { routeId: "abc" }, returnTo: "/routes/abc" });
  });

  it("returns empty object for missing or malformed state", async () => {
    const { decodeOAuthState } = await importPipeline();
    expect(decodeOAuthState(null)).toEqual({});
    expect(decodeOAuthState("not-base64-json!!")).toEqual({});
  });
});
