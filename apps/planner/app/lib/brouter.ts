const BROUTER_URL = process.env.BROUTER_URL ?? "http://localhost:17777";

export interface RouteRequest {
  waypoints: Array<{ lat: number; lon: number }>;
  profile?: string;
  alternativeIdx?: number;
  format?: string;
}

/**
 * Compute a route segment-by-segment between consecutive waypoints.
 * This matches bikerouter.de's behavior and guarantees the route
 * passes through every waypoint.
 */
export async function computeRoute(request: RouteRequest): Promise<unknown> {
  if (request.waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }

  const profile = request.profile ?? "trekking";
  const format = request.format ?? "geojson";

  // Route each segment independently
  const segments = await Promise.all(
    request.waypoints.slice(0, -1).map((wp, i) => {
      const next = request.waypoints[i + 1]!;
      const lonlats = `${wp.lon},${wp.lat}|${next.lon},${next.lat}`;
      const params = new URLSearchParams({
        lonlats,
        profile,
        alternativeidx: "0",
        format,
      });
      return fetchSegment(`${BROUTER_URL}/brouter?${params}`);
    }),
  );

  // Merge GeoJSON segments into a single FeatureCollection
  return mergeGeoJsonSegments(segments);
}

async function fetchSegment(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`BRouter error (${response.status}): ${body}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

interface GeoJsonFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][] };
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

function mergeGeoJsonSegments(segments: Record<string, unknown>[]): GeoJsonCollection {
  const allCoords: number[][] = [];
  let totalLength = 0;
  let totalAscend = 0;
  let totalTime = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] as unknown as GeoJsonCollection;
    const feature = segment.features?.[0];
    if (!feature) continue;

    const coords = feature.geometry.coordinates;
    // Skip first point of subsequent segments to avoid duplicates
    const startIdx = i === 0 ? 0 : 1;
    for (let j = startIdx; j < coords.length; j++) {
      allCoords.push(coords[j]!);
    }

    // Accumulate stats
    const props = feature.properties;
    totalLength += parseInt(String(props["track-length"] ?? "0"));
    totalAscend += parseInt(String(props["filtered ascend"] ?? "0"));
    totalTime += parseInt(String(props["total-time"] ?? "0"));
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          "track-length": String(totalLength),
          "filtered ascend": String(totalAscend),
          "total-time": String(totalTime),
          creator: "trails.cool (BRouter segments)",
        },
        geometry: {
          type: "LineString",
          coordinates: allCoords,
        },
      },
    ],
  };
}

export function getBRouterUrl(): string {
  return BROUTER_URL;
}
