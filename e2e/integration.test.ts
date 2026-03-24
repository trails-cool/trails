import { test, expect } from "@playwright/test";

/**
 * Integration tests that require the full dev stack:
 * - PostgreSQL (for auth and routes)
 * - BRouter (for route computation)
 *
 * Run with: pnpm dev:full (in another terminal), then pnpm test:e2e
 * These tests are skipped in CI unless services are available.
 */

const JOURNAL = "http://localhost:3000";
const PLANNER = "http://localhost:3001";

// Helper: check if DB is available (checks Planner API)
async function isDbAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(`${PLANNER}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return resp.ok; // 201 = DB available, 503 = DB unavailable
  } catch {
    return false;
  }
}

test.describe("Integration: Journal ↔ Planner handoff", () => {
  test.beforeAll(async () => {
    const dbAvailable = await isDbAvailable();
    test.skip(!dbAvailable, "Database not available — run pnpm dev:full");
  });

  test("GPX import → view route → export GPX", async ({ request }) => {
    // This tests the API flow without needing WebAuthn
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.52" lon="13.405"><name>Berlin</name></wpt>
  <wpt lat="52.50" lon="13.35"><name>Tiergarten</name></wpt>
  <trk><trkseg>
    <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
    <trkpt lat="52.51" lon="13.38"><ele>40</ele></trkpt>
    <trkpt lat="52.50" lon="13.35"><ele>35</ele></trkpt>
  </trkseg></trk>
</gpx>`;

    // Create a planner session with GPX
    const sessionResp = await request.post(`${PLANNER}/api/sessions`, {
      data: { gpx },
    });
    expect(sessionResp.ok()).toBeTruthy();
    const session = await sessionResp.json();
    expect(session.initialWaypoints).toHaveLength(2);
    expect(session.initialWaypoints[0].name).toBe("Berlin");
  });
});

test.describe("Integration: BRouter routing", () => {
  test.beforeAll(async () => {
    try {
      const resp = await fetch(`${PLANNER}/api/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waypoints: [
            { lat: 52.516, lon: 13.377 },
            { lat: 52.515, lon: 13.351 },
          ],
          profile: "trekking",
        }),
      });
      test.skip(!resp.ok, "BRouter not available — start with pnpm dev:full");
    } catch {
      test.skip(true, "BRouter not available");
    }
  });

  test("computes route between Berlin waypoints", async ({ request }) => {
    const response = await request.post(`${PLANNER}/api/route`, {
      data: {
        waypoints: [
          { lat: 52.516, lon: 13.377 },
          { lat: 52.515, lon: 13.351 },
        ],
        profile: "trekking",
      },
    });
    expect(response.ok()).toBeTruthy();
    const geojson = await response.json();
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry.type).toBe("LineString");
    expect(geojson.features[0].geometry.coordinates.length).toBeGreaterThan(10);
  });

  test("routes through all waypoints (segment by segment)", async ({ request }) => {
    const response = await request.post(`${PLANNER}/api/route`, {
      data: {
        waypoints: [
          { lat: 52.520, lon: 13.405 },
          { lat: 52.516, lon: 13.377 },
          { lat: 52.510, lon: 13.390 },
        ],
        profile: "trekking",
      },
    });
    expect(response.ok()).toBeTruthy();
    const geojson = await response.json();
    const coords = geojson.features[0].geometry.coordinates;

    // Route should pass near the middle waypoint (52.516, 13.377)
    const nearMiddle = coords.some(
      (c: number[]) =>
        Math.abs(c[1] - 52.516) < 0.005 && Math.abs(c[0] - 13.377) < 0.005,
    );
    expect(nearMiddle).toBeTruthy();
  });

  test("returns rate limit headers", async ({ request }) => {
    const response = await request.post(`${PLANNER}/api/route`, {
      data: {
        waypoints: [
          { lat: 52.516, lon: 13.377 },
          { lat: 52.515, lon: 13.351 },
        ],
      },
    });
    expect(response.headers()["x-ratelimit-remaining"]).toBeDefined();
  });

  test("rejects with fewer than 2 waypoints", async ({ request }) => {
    const response = await request.post(`${PLANNER}/api/route`, {
      data: {
        waypoints: [{ lat: 52.516, lon: 13.377 }],
      },
    });
    expect(response.status()).toBe(400);
  });
});
