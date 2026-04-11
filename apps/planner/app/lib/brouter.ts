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

export interface EnrichedRoute {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  segmentBoundaries: number[];             // coordinate index where each waypoint segment starts
  surfaces: string[];                      // surface type per coordinate point (e.g. "asphalt", "gravel")
  highways: string[];                      // highway classification per coordinate point (e.g. "cycleway", "residential")
  maxspeeds: string[];                    // speed limit per coordinate point (e.g. "30", "50", "none")
  smoothnesses: string[];                 // smoothness per coordinate point (e.g. "good", "bad")
  tracktypes: string[];                   // track type per coordinate point (e.g. "grade1", "grade5")
  cycleways: string[];                    // cycleway type per coordinate point (e.g. "track", "lane")
  bikeroutes: string[];                   // bicycle route network per coordinate point (e.g. "icn", "lcn")
  totalLength: number;
  totalAscend: number;
  totalTime: number;
  geojson: GeoJsonCollection;              // original merged GeoJSON for backwards compat
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
        tiledesc: "true",
      });
      if (nogoParam) params.set("polygons", nogoParam);
      return fetchSegment(`${BROUTER_URL}/brouter?${params}`);
    }),
  );

  // Merge GeoJSON segments into a single FeatureCollection
  return mergeGeoJsonSegments(segments);
}

export class BRouterError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BRouterError";
  }
}

async function fetchSegment(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new BRouterError(body.trim(), response.status);
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

export function mergeGeoJsonSegments(segments: Record<string, unknown>[]): EnrichedRoute {
  const allCoords: [number, number, number][] = [];
  const allSurfaces: string[] = [];
  const allHighways: string[] = [];
  const allMaxspeeds: string[] = [];
  const allSmoothnesses: string[] = [];
  const allTracktypes: string[] = [];
  const allCycleways: string[] = [];
  const allBikeroutes: string[] = [];
  const segmentBoundaries: number[] = [];
  let totalLength = 0;
  let totalAscend = 0;
  let totalTime = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] as unknown as GeoJsonCollection;
    const feature = segment.features?.[0];
    if (!feature) continue;

    // Record where this segment starts in the merged coordinate array
    segmentBoundaries.push(allCoords.length);

    const coords = feature.geometry.coordinates;
    // Extract surface and highway data from BRouter messages (tiledesc=true)
    const wayTagData = extractWayTagData(feature.properties);

    // Skip first point of subsequent segments to avoid duplicates
    const startIdx = i === 0 ? 0 : 1;
    for (let j = startIdx; j < coords.length; j++) {
      const c = coords[j]!;
      allCoords.push([c[0]!, c[1]!, c[2] ?? 0]);
      allSurfaces.push(wayTagData.surfaces.get(j) ?? wayTagData.surfaces.get(j - 1) ?? "unknown");
      allHighways.push(wayTagData.highways.get(j) ?? wayTagData.highways.get(j - 1) ?? "unknown");
      allMaxspeeds.push(wayTagData.maxspeeds.get(j) ?? wayTagData.maxspeeds.get(j - 1) ?? "unknown");
      allSmoothnesses.push(wayTagData.smoothnesses.get(j) ?? wayTagData.smoothnesses.get(j - 1) ?? "unknown");
      allTracktypes.push(wayTagData.tracktypes.get(j) ?? wayTagData.tracktypes.get(j - 1) ?? "unknown");
      allCycleways.push(wayTagData.cycleways.get(j) ?? wayTagData.cycleways.get(j - 1) ?? "unknown");
      allBikeroutes.push(wayTagData.bikeroutes.get(j) ?? wayTagData.bikeroutes.get(j - 1) ?? "none");
    }

    // Accumulate stats
    const props = feature.properties;
    totalLength += parseInt(String(props["track-length"] ?? "0"));
    totalAscend += parseInt(String(props["filtered ascend"] ?? "0"));
    totalTime += parseInt(String(props["total-time"] ?? "0"));
  }

  const geojson: GeoJsonCollection = {
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

  return {
    coordinates: allCoords,
    segmentBoundaries,
    surfaces: allSurfaces,
    highways: allHighways,
    maxspeeds: allMaxspeeds,
    smoothnesses: allSmoothnesses,
    tracktypes: allTracktypes,
    cycleways: allCycleways,
    bikeroutes: allBikeroutes,
    totalLength,
    totalAscend,
    totalTime,
    geojson,
  };
}

interface WayTagData {
  surfaces: Map<number, string>;
  highways: Map<number, string>;
  maxspeeds: Map<number, string>;
  smoothnesses: Map<number, string>;
  tracktypes: Map<number, string>;
  cycleways: Map<number, string>;
  bikeroutes: Map<number, string>;
}

/**
 * Extract surface and highway type per message row from BRouter's tiledesc messages.
 * Messages is an array of arrays: first row is headers, subsequent rows are data.
 * We look for the "WayTags" column which contains OSM tags like "surface=asphalt" and "highway=cycleway".
 */
function extractWayTagData(properties: Record<string, unknown>): WayTagData {
  const surfaces = new Map<number, string>();
  const highways = new Map<number, string>();
  const maxspeeds = new Map<number, string>();
  const smoothnesses = new Map<number, string>();
  const tracktypes = new Map<number, string>();
  const cycleways = new Map<number, string>();
  const bikeroutes = new Map<number, string>();
  const messages = properties.messages as string[][] | undefined;
  if (!messages || messages.length < 2) return { surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes };

  const headers = messages[0]!;
  const wayTagsIdx = headers.indexOf("WayTags");
  if (wayTagsIdx === -1) return { surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes };

  for (let i = 1; i < messages.length; i++) {
    const row = messages[i]!;
    const tags = row[wayTagsIdx] ?? "";
    const surfaceMatch = tags.match(/surface=(\S+)/);
    surfaces.set(i - 1, surfaceMatch ? surfaceMatch[1]! : "unknown");
    const highwayMatch = tags.match(/highway=(\S+)/);
    highways.set(i - 1, highwayMatch ? highwayMatch[1]! : "unknown");

    // Extract maxspeed with direction handling
    const reversedirection = /reversedirection=yes/.test(tags);
    let speed: string | null = null;
    if (!reversedirection) {
      const fwd = tags.match(/maxspeed:forward=(\S+)/);
      if (fwd) speed = fwd[1]!;
    } else {
      const bwd = tags.match(/maxspeed:backward=(\S+)/);
      if (bwd) speed = bwd[1]!;
    }
    if (!speed) {
      const plain = tags.match(/maxspeed=(\S+)/);
      speed = plain ? plain[1]! : "unknown";
    }
    maxspeeds.set(i - 1, speed);

    // Extract smoothness
    const smoothnessMatch = tags.match(/smoothness=(\S+)/);
    smoothnesses.set(i - 1, smoothnessMatch ? smoothnessMatch[1]! : "unknown");

    // Extract tracktype
    const tracktypeMatch = tags.match(/tracktype=(\S+)/);
    tracktypes.set(i - 1, tracktypeMatch ? tracktypeMatch[1]! : "unknown");

    // Extract cycleway with direction handling
    let cycleway: string | null = null;
    if (!reversedirection) {
      const right = tags.match(/cycleway:right=(\S+)/);
      if (right) cycleway = right[1]!;
    } else {
      const left = tags.match(/cycleway:left=(\S+)/);
      if (left) cycleway = left[1]!;
    }
    if (!cycleway) {
      const bare = tags.match(/cycleway=(\S+)/);
      cycleway = bare ? bare[1]! : "unknown";
    }
    cycleways.set(i - 1, cycleway);

    // Extract bicycle route network (priority: icn > ncn > rcn > lcn)
    let bikeroute = "none";
    if (/route_bicycle_icn=yes/.test(tags)) bikeroute = "icn";
    else if (/route_bicycle_ncn=yes/.test(tags)) bikeroute = "ncn";
    else if (/route_bicycle_rcn=yes/.test(tags)) bikeroute = "rcn";
    else if (/route_bicycle_lcn=yes/.test(tags)) bikeroute = "lcn";
    bikeroutes.set(i - 1, bikeroute);
  }
  return { surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes };
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
