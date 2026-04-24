import { mergeGeoJsonSegments, type EnrichedRoute, type NoGoArea, type Waypoint } from "./route-merge";

export { mergeGeoJsonSegments };
export type { EnrichedRoute, NoGoArea };

const BROUTER_URL = process.env.BROUTER_URL ?? "http://localhost:17777";

// The BRouter host's Caddy sidecar requires every request to carry a
// shared-secret header. Missing in production = every request 403s, so
// crash loudly at startup rather than during the first route request.
if (process.env.NODE_ENV === "production" && !process.env.BROUTER_AUTH_TOKEN) {
  throw new Error(
    "BROUTER_AUTH_TOKEN is required in production. The BRouter Caddy " +
      "sidecar rejects unauthenticated requests with 403. Check the " +
      "SOPS-encrypted infrastructure/secrets.app.env and the cd-apps " +
      "env wiring.",
  );
}

// Read at call time so tests can stub via vi.stubEnv without module reset.
function authHeaders(): HeadersInit {
  const token = process.env.BROUTER_AUTH_TOKEN;
  return token ? { "X-BRouter-Auth": token } : {};
}

export interface RouteRequest {
  waypoints: Array<{ lat: number; lon: number }>;
  profile?: string;
  alternativeIdx?: number;
  format?: string;
  noGoAreas?: NoGoArea[];
}

/**
 * Compute a route segment-by-segment between consecutive waypoints.
 * This matches bikerouter.de's behavior and guarantees the route
 * passes through every waypoint.
 */
export async function computeRoute(request: RouteRequest): Promise<EnrichedRoute> {
  if (request.waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }

  const pairs = request.waypoints.slice(0, -1).map((from, i) => ({
    from,
    to: request.waypoints[i + 1]!,
  }));
  const segments = await fetchSegments({
    pairs,
    profile: request.profile,
    noGoAreas: request.noGoAreas,
  });
  return mergeGeoJsonSegments(segments);
}

export class BRouterError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "BRouterError";
    this.statusCode = statusCode;
  }
}

async function fetchSegment(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    const body = await response.text();
    throw new BRouterError(body.trim(), response.status);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Fetch a set of waypoint-pair segments from BRouter in parallel. Returned
 * segments are in the same order as the input `pairs`. Used by the
 * `/api/route-segments` endpoint: the browser cache sends only the pairs
 * it doesn't already have, and merges the response client-side.
 */
export async function fetchSegments(request: {
  pairs: Array<{ from: Waypoint; to: Waypoint }>;
  profile?: string;
  noGoAreas?: NoGoArea[];
}): Promise<Record<string, unknown>[]> {
  const profile = request.profile ?? "trekking";
  const nogoParam = request.noGoAreas?.length ? noGoAreasToParam(request.noGoAreas) : undefined;

  return Promise.all(
    request.pairs.map(({ from, to }) => {
      const lonlats = `${from.lon},${from.lat}|${to.lon},${to.lat}`;
      const params = new URLSearchParams({
        lonlats,
        profile,
        alternativeidx: "0",
        format: "geojson",
        tiledesc: "true",
      });
      if (nogoParam) params.set("polygons", nogoParam);
      return fetchSegment(`${BROUTER_URL}/brouter?${params}`);
    }),
  );
}

/**
 * Convert no-go area polygons to BRouter's `polygons` parameter format.
 * Format: lon1,lat1,lon2,lat2,...,lonN,latN separated by `|` per polygon.
 */
function noGoAreasToParam(areas: NoGoArea[]): string {
  return areas
    .map((area) => {
      if (area.points.length < 3) return null;
      return area.points.map((p) => `${p.lon},${p.lat}`).join(",");
    })
    .filter(Boolean)
    .join("|");
}

export function getBRouterUrl(): string {
  return BROUTER_URL;
}

/**
 * Single-segment GPX fetch. Used by callers (notably the Journal's
 * demo-bot) that only need the raw GPX track for two endpoints — no
 * multi-waypoint merge, no way-tag enrichment. Throws BRouterError on
 * non-2xx so the action handler can map it to an HTTP status.
 */
export async function computeSegmentGpx(request: {
  waypoints: Array<{ lat: number; lon: number }>;
  profile?: string;
  noGoAreas?: NoGoArea[];
}): Promise<string> {
  if (request.waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }
  const profile = request.profile ?? "trekking";
  const lonlats = request.waypoints.map((w) => `${w.lon},${w.lat}`).join("|");
  const params = new URLSearchParams({
    lonlats,
    profile,
    alternativeidx: "0",
    format: "gpx",
  });
  const nogoParam = request.noGoAreas?.length ? noGoAreasToParam(request.noGoAreas) : undefined;
  if (nogoParam) params.set("polygons", nogoParam);

  const resp = await fetch(`${BROUTER_URL}/brouter?${params}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new BRouterError(body.trim(), resp.status);
  }
  const gpx = await resp.text();
  if (!gpx.includes("<trkpt")) throw new BRouterError("no route found", 422);
  return gpx;
}
