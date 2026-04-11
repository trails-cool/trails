import type { Page } from "@playwright/test";

/**
 * Canned enriched route for 3 nearby Berlin waypoints:
 *   [52.520, 13.405] → [52.516, 13.377] → [52.510, 13.390]
 *
 * ~3.2km total, 6 track points with elevation.
 */
const MOCK_ROUTE_3WP = {
  geojson: {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [13.405, 52.520, 34], [13.398, 52.519, 36], [13.391, 52.518, 38],
          [13.384, 52.517, 40], [13.377, 52.516, 42],
          [13.379, 52.514, 40], [13.382, 52.513, 38],
          [13.385, 52.512, 36], [13.388, 52.511, 35], [13.390, 52.510, 34],
        ],
      },
      properties: {},
    }],
  },
  coordinates: [
    [13.405, 52.520, 34], [13.398, 52.519, 36], [13.391, 52.518, 38],
    [13.384, 52.517, 40], [13.377, 52.516, 42],
    [13.379, 52.514, 40], [13.382, 52.513, 38],
    [13.385, 52.512, 36], [13.388, 52.511, 35], [13.390, 52.510, 34],
  ],
  segmentBoundaries: [0, 4],
  totalLength: 3200,
  totalAscend: 8,
  surfaces: [
    "asphalt", "asphalt", "cobblestone", "cobblestone", "gravel",
    "gravel", "asphalt", "asphalt", "asphalt", "asphalt",
  ],
  highways: [
    "residential", "residential", "cycleway", "cycleway", "path",
    "path", "tertiary", "tertiary", "residential", "residential",
  ],
  maxspeeds: [
    "30", "30", "unknown", "unknown", "unknown",
    "unknown", "50", "50", "30", "30",
  ],
};

/**
 * Canned enriched route for 2 nearby Berlin waypoints:
 *   [52.520, 13.405] → [52.515, 13.351]
 *
 * ~3.8km total, 6 track points with elevation.
 */
const MOCK_ROUTE_2WP = {
  geojson: {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [13.405, 52.520, 34], [13.394, 52.519, 36], [13.383, 52.518, 40],
          [13.372, 52.517, 38], [13.361, 52.516, 36], [13.351, 52.515, 35],
        ],
      },
      properties: {},
    }],
  },
  coordinates: [
    [13.405, 52.520, 34], [13.394, 52.519, 36], [13.383, 52.518, 40],
    [13.372, 52.517, 38], [13.361, 52.516, 36], [13.351, 52.515, 35],
  ],
  segmentBoundaries: [0],
  totalLength: 3800,
  totalAscend: 6,
  surfaces: [
    "asphalt", "asphalt", "gravel", "gravel", "asphalt", "asphalt",
  ],
  highways: [
    "secondary", "secondary", "cycleway", "cycleway", "residential", "residential",
  ],
  maxspeeds: [
    "50", "50", "unknown", "unknown", "30", "30",
  ],
};

/**
 * Mock the BRouter route API to return instant, deterministic responses.
 * Selects the appropriate canned response based on waypoint count.
 */
export async function mockBRouter(page: Page) {
  await page.route("**/api/route", async (route) => {
    const body = route.request().postDataJSON();
    const wpCount = body?.waypoints?.length ?? 0;
    const mock = wpCount >= 3 ? MOCK_ROUTE_3WP : MOCK_ROUTE_2WP;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mock),
    });
  });
}

/**
 * Convert a lat/lon to pixel coordinates on the Leaflet map.
 * Requires MapExposer to have set window.__leafletMap.
 */
export async function latLngToPixel(page: Page, lat: number, lon: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([la, ln]) => {
    const map = (window as any).__leafletMap;
    if (!map) throw new Error("__leafletMap not available");
    const point = map.latLngToContainerPoint([la, ln]);
    return { x: point.x, y: point.y };
  }, [lat, lon]);
}
