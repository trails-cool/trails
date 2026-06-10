import { describe, it, expect, vi, beforeEach } from "vitest";
import { TERMS_VERSION } from "~/lib/legal";

const mockUser = {
  id: "user-1", email: "t@t.com", username: "t", domain: "localhost",
  displayName: null, bio: null, createdAt: new Date(), termsVersion: TERMS_VERSION,
};
const OWN_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const mockGetAuthenticatedUser = vi.fn();
const loadOwnedRoute = vi.fn();
const loadOwnedActivity = vi.fn();

vi.mock("~/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("~/lib/auth.server", () => ({ getSessionUser: vi.fn() }));
vi.mock("~/lib/oauth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/oauth.server")>();
  return { ...actual, getAuthenticatedUser: mockGetAuthenticatedUser };
});
vi.mock("~/lib/ownership.server", () => ({
  loadOwnedRoute: (...a: unknown[]) => loadOwnedRoute(...a),
  loadOwnedActivity: (...a: unknown[]) => loadOwnedActivity(...a),
}));

function authRequest(body: unknown) {
  return new Request("http://localhost:3000/api/v1/uploads", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function routeArgs(request: Request): any {
  return { request, params: {}, context: {}, unstable_url: new URL(request.url), unstable_pattern: "api/v1/uploads" };
}

const validBody = {
  filename: "photo.jpg",
  contentType: "image/jpeg",
  resourceType: "activity" as const,
  resourceId: OWN_ID,
};

describe("POST /api/v1/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
  });

  it("mints a key scoped to the owned resource, with a sanitized filename", async () => {
    loadOwnedActivity.mockResolvedValue({ ok: true, entity: { id: OWN_ID, ownerId: "user-1" } });
    const { action } = await import("./api.v1.uploads.ts");
    const resp = await action(routeArgs(authRequest({ ...validBody, filename: "../../evil name.jpg" }))) as Response;

    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(loadOwnedActivity).toHaveBeenCalledWith(OWN_ID, "user-1");
    expect(json.key).toMatch(new RegExp(`^activity/${OWN_ID}/[0-9a-f-]+-evil_name\\.jpg$`));
    expect(json.key).not.toContain("..");
  });

  it("rejects uploads to a resource the caller does not own (404, no leak)", async () => {
    loadOwnedActivity.mockResolvedValue({ ok: false, reason: "not_owner" });
    const { action } = await import("./api.v1.uploads.ts");
    const resp = await action(routeArgs(authRequest({ ...validBody, resourceId: OTHER_ID }))) as Response;
    expect(resp.status).toBe(404);
  });

  it("rejects a disallowed content type before any ownership work", async () => {
    const { action } = await import("./api.v1.uploads.ts");
    const resp = await action(routeArgs(authRequest({ ...validBody, contentType: "text/html" }))) as Response;
    expect(resp.status).toBe(400);
    expect(loadOwnedActivity).not.toHaveBeenCalled();
  });

  it("routes route-type uploads through the route ownership check", async () => {
    loadOwnedRoute.mockResolvedValue({ ok: true, entity: { id: OWN_ID, ownerId: "user-1" } });
    const { action } = await import("./api.v1.uploads.ts");
    const resp = await action(routeArgs(authRequest({ ...validBody, resourceType: "route" }))) as Response;
    expect(resp.status).toBe(200);
    expect(loadOwnedRoute).toHaveBeenCalledWith(OWN_ID, "user-1");
  });
});
