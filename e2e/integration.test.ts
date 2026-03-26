import { test, expect } from "@playwright/test";

/**
 * Integration tests that require the full dev stack:
 * - PostgreSQL (for sessions)
 * - BRouter (for route computation)
 *
 * In CI, these services are started by the workflow.
 * Locally, run `pnpm dev:full` first.
 */

const PLANNER = "http://localhost:3001";

test.describe("Integration: Journal ↔ Planner handoff", () => {
  test("GPX import → view route → export GPX", async ({ request }) => {
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

  test("accepts no-go areas parameter", async ({ request }) => {
    const response = await request.post(`${PLANNER}/api/route`, {
      data: {
        waypoints: [
          { lat: 52.516, lon: 13.377 },
          { lat: 52.515, lon: 13.351 },
        ],
        profile: "trekking",
        noGoAreas: [
          {
            points: [
              { lat: 52.516, lon: 13.365 },
              { lat: 52.514, lon: 13.365 },
              { lat: 52.514, lon: 13.370 },
              { lat: 52.516, lon: 13.370 },
            ],
          },
        ],
      },
    });
    expect(response.ok()).toBeTruthy();
    const geojson = await response.json();
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry.type).toBe("LineString");
  });
});
