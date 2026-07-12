import { describe, it, expect, vi, beforeEach } from "vitest";

// Keep prom-client (and its DB-collecting gauges) out of these tests; assert
// on the counter labels instead.
vi.mock("~/lib/metrics.server", () => ({
  poiApiRequests: { inc: vi.fn() },
}));

vi.mock("~/lib/db.ts", () => ({ getDb: vi.fn() }));
vi.mock("~/lib/require-session.ts", () => ({ requireSession: vi.fn() }));
vi.mock("~/lib/rate-limit.ts", () => ({ checkRateLimit: vi.fn() }));

import { loader } from "./api.pois.ts";
import { getDb } from "~/lib/db.ts";
import { requireSession } from "~/lib/require-session.ts";
import { checkRateLimit } from "~/lib/rate-limit.ts";
import { poiApiRequests } from "~/lib/metrics.server";

const mockedGetDb = vi.mocked(getDb);
const mockedRequireSession = vi.mocked(requireSession);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

// Minimal drizzle chain: select().from().where().limit() resolves to `rows`.
function stubDb(rows: unknown[] | Error) {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => (rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows)),
  };
  mockedGetDb.mockReturnValue(chain as never);
}

const VALID_BBOX = "52.50,13.30,52.60,13.50";

function makeRequest(query: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3001/api/pois?${query}`, {
    method: "GET",
    headers: { "x-trails-session": "sess-1", ...headers },
  });
}

function call(request: Request) {
  return loader({ request } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated + under the rate limit.
  mockedRequireSession.mockResolvedValue({ id: "sess-1" } as never);
  mockedCheckRateLimit.mockReturnValue({ allowed: true, remaining: 100 });
});

describe("api.pois loader", () => {
  it("happy path: returns POIs from the index with a short private cache", async () => {
    stubDb([
      {
        osmId: "123",
        category: "drinking_water",
        name: "Brunnen",
        tags: { amenity: "drinking_water", name: "Brunnen" },
        lat: 52.52,
        lon: 13.4,
      },
    ]);

    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");

    const body = await res.json();
    expect(body.pois).toHaveLength(1);
    expect(body.pois[0]).toMatchObject({
      id: 123,
      lat: 52.52,
      lon: 13.4,
      name: "Brunnen",
      category: "drinking_water",
    });
    expect(poiApiRequests.inc).toHaveBeenCalledWith({ status: "ok" });
  });

  it("returns an empty list (200) when the viewport has no POIs", async () => {
    stubDb([]);
    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`));
    expect(res.status).toBe(200);
    expect((await res.json()).pois).toEqual([]);
  });

  it("400s on a malformed bbox and never queries the DB", async () => {
    const res = await call(makeRequest("bbox=not-a-bbox&categories=drinking_water"));
    expect(res.status).toBe(400);
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(poiApiRequests.inc).toHaveBeenCalledWith({ status: "bad_request" });
  });

  it("400s on an out-of-range / inverted bbox", async () => {
    // north < south
    const res = await call(makeRequest("bbox=52.60,13.30,52.50,13.50&categories=toilets"));
    expect(res.status).toBe(400);
  });

  it("400s on an unknown category", async () => {
    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water,banks`));
    expect(res.status).toBe(400);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it("400s when no categories are supplied", async () => {
    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=`));
    expect(res.status).toBe(400);
  });

  it("429s when rate limited, without executing any DB query", async () => {
    mockedCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(poiApiRequests.inc).toHaveBeenCalledWith({ status: "rate_limited" });
  });

  it("401s when there is no valid session (and rate limit not consulted)", async () => {
    mockedRequireSession.mockResolvedValue(new Response("Missing session", { status: 401 }));
    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`, {}));
    expect(res.status).toBe(401);
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
    expect(poiApiRequests.inc).toHaveBeenCalledWith({ status: "unauthorized" });
  });

  it("403s on a cross-origin request", async () => {
    const res = await call(
      makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`, {
        origin: "https://evil.example",
      }),
    );
    expect(res.status).toBe(403);
    expect(poiApiRequests.inc).toHaveBeenCalledWith({ status: "forbidden" });
  });

  it("allows a matching same-origin Origin header (via forwarded host/proto)", async () => {
    stubDb([]);
    const res = await call(
      makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`, {
        origin: "https://planner.trails.cool",
        "x-forwarded-host": "planner.trails.cool",
        "x-forwarded-proto": "https",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("503s (graceful) when the index table is missing or the DB is down", async () => {
    stubDb(new Error('relation "planner.pois" does not exist'));
    const res = await call(makeRequest(`bbox=${VALID_BBOX}&categories=drinking_water`));
    expect(res.status).toBe(503);
    expect(poiApiRequests.inc).toHaveBeenCalledWith({ status: "error" });
  });
});
