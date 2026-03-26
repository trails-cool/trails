const BROUTER_URL = process.env.BROUTER_URL ?? "http://localhost:17777";

export interface NoGoArea {
  points: Array<{ lat: number; lon: number }>;
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
export async function computeRoute(request: RouteRequest): Promise<unknown> {
  if (request.waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }

  const profile = request.profile ?? "trekking";
  const format = request.format ?? "geojson";

  // Build no-go parameter if areas exist
  const nogoParam = request.noGoAreas?.length
    ? noGoAreasToParam(request.noGoAreas)
    : undefined;

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
      if (nogoParam) params.set("nogos", nogoParam);
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

/**
 * Convert no-go area polygons to BRouter's `nogos` parameter format.
 * BRouter accepts `lon,lat,radius` per no-go circle, separated by `|`.
 * We approximate each polygon as a circle: centroid + max distance to any vertex.
 */
function noGoAreasToParam(areas: NoGoArea[]): string {
  return areas
    .map((area) => {
      const pts = area.points;
      if (pts.length === 0) return null;
      // Centroid
      const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const cLon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
      // Max distance from centroid in meters (approximate)
      const maxDist = Math.max(
        ...pts.map((p) => haversineMeters(cLat, cLon, p.lat, p.lon)),
      );
      return `${cLon},${cLat},${Math.ceil(maxDist)}`;
    })
    .filter(Boolean)
    .join("|");
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getBRouterUrl(): string {
  return BROUTER_URL;
}
