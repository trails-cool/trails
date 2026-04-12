import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUser = { id: "user-1", email: "test@test.com", username: "test", domain: "localhost", displayName: null, bio: null, createdAt: new Date() };
const mockGetAuthenticatedUser = vi.fn();
const mockListRoutes = vi.fn();
const mockCreateRoute = vi.fn();
const mockGetRouteWithVersions = vi.fn();
const mockDeleteRoute = vi.fn();

vi.mock("~/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("~/lib/auth.server", () => ({ getSessionUser: vi.fn() }));
vi.mock("~/lib/oauth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/oauth.server")>();
  return { ...actual, getAuthenticatedUser: mockGetAuthenticatedUser };
});
vi.mock("~/lib/routes.server", () => ({
  listRoutes: mockListRoutes,
  createRoute: mockCreateRoute,
  getRouteWithVersions: mockGetRouteWithVersions,
  updateRoute: vi.fn(),
  deleteRoute: mockDeleteRoute,
}));

function authRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost:3000${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedUser.mockResolvedValue(mockUser);
});

describe("GET /api/v1/routes", () => {
  it("returns paginated routes", async () => {
    const now = new Date();
    mockListRoutes.mockResolvedValue([
      {
        id: "r1", name: "Tour", description: "", distance: 42000,
        elevationGain: 340, elevationLoss: 320, routingProfile: "fastbike",
        dayBreaks: [], geojson: null, ownerId: "user-1", gpx: null,
        tags: null, plannerState: null, createdAt: now, updatedAt: now,
      },
    ]);

    const { loader } = await import("./api.v1.routes._index.ts");
    const resp = await loader({ request: authRequest("/api/v1/routes"), params: {}, context: {} }) as Response;
    const data = await resp.json();

    expect(data.routes).toHaveLength(1);
    expect(data.routes[0].id).toBe("r1");
    expect(data.nextCursor).toBeNull();
  });

  it("returns 401 without auth", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);
    const { loader } = await import("./api.v1.routes._index.ts");

    try {
      await loader({ request: new Request("http://localhost:3000/api/v1/routes"), params: {}, context: {} });
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(401);
    }
  });
});

describe("POST /api/v1/routes", () => {
  it("creates a route with valid body", async () => {
    mockCreateRoute.mockResolvedValue("new-id");
    const { action } = await import("./api.v1.routes._index.ts");

    const resp = await action({
      request: authRequest("/api/v1/routes", {
        method: "POST",
        body: JSON.stringify({ name: "New Route" }),
      }),
      params: {}, context: {},
    }) as Response;

    expect(resp.status).toBe(201);
    const data = await resp.json();
    expect(data.id).toBe("new-id");
  });

  it("returns 400 on validation error", async () => {
    const { action } = await import("./api.v1.routes._index.ts");
    const resp = await action({
      request: authRequest("/api/v1/routes", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      }),
      params: {}, context: {},
    }) as Response;

    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/v1/routes/:id", () => {
  it("returns route detail", async () => {
    const now = new Date();
    mockGetRouteWithVersions.mockResolvedValue({
      id: "r1", name: "Tour", description: "", distance: 42000,
      elevationGain: 340, elevationLoss: 320, routingProfile: "fastbike",
      dayBreaks: [], gpx: "<gpx/>", ownerId: "user-1",
      tags: null, plannerState: null, createdAt: now, updatedAt: now,
      versions: [{ id: "v1", routeId: "r1", version: 1, gpx: "<gpx/>", createdBy: "user-1", changeDescription: null, createdAt: now }],
    });

    const { loader } = await import("./api.v1.routes.$id.ts");
    const resp = await loader({
      request: authRequest("/api/v1/routes/r1"),
      params: { id: "r1" }, context: {},
    }) as Response;

    const data = await resp.json();
    expect(data.id).toBe("r1");
    expect(data.gpx).toBe("<gpx/>");
    expect(data.versions).toHaveLength(1);
  });

  it("returns 404 for missing route", async () => {
    mockGetRouteWithVersions.mockResolvedValue(null);
    const { loader } = await import("./api.v1.routes.$id.ts");
    const resp = await loader({
      request: authRequest("/api/v1/routes/missing"),
      params: { id: "missing" }, context: {},
    }) as Response;

    expect(resp.status).toBe(404);
  });
});

describe("DELETE /api/v1/routes/:id", () => {
  it("returns 204 on success", async () => {
    mockDeleteRoute.mockResolvedValue(true);
    const { action } = await import("./api.v1.routes.$id.ts");
    const resp = await action({
      request: authRequest("/api/v1/routes/r1", { method: "DELETE" }),
      params: { id: "r1" }, context: {},
    }) as Response;

    expect(resp.status).toBe(204);
  });

  it("returns 404 if not found", async () => {
    mockDeleteRoute.mockResolvedValue(false);
    const { action } = await import("./api.v1.routes.$id.ts");
    const resp = await action({
      request: authRequest("/api/v1/routes/missing", { method: "DELETE" }),
      params: { id: "missing" }, context: {},
    }) as Response;

    expect(resp.status).toBe(404);
  });
});
