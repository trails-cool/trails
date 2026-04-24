// Pure, isomorphic helpers for stitching BRouter segment responses into an
// EnrichedRoute and for keying the client-side segment cache. Imported by
// both the server-side `brouter.ts` and the browser (use-routing.ts).

export interface NoGoArea {
  points: Array<{ lat: number; lon: number }>;
}

export interface Waypoint {
  lat: number;
  lon: number;
}

export interface EnrichedRoute {
  coordinates: [number, number, number][];
  segmentBoundaries: number[];
  surfaces: string[];
  highways: string[];
  maxspeeds: string[];
  smoothnesses: string[];
  tracktypes: string[];
  cycleways: string[];
  bikeroutes: string[];
  totalLength: number;
  totalAscend: number;
  totalTime: number;
  geojson: GeoJsonCollection;
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

    segmentBoundaries.push(allCoords.length);

    const coords = feature.geometry.coordinates;
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

    const smoothnessMatch = tags.match(/smoothness=(\S+)/);
    smoothnesses.set(i - 1, smoothnessMatch ? smoothnessMatch[1]! : "unknown");

    const tracktypeMatch = tags.match(/tracktype=(\S+)/);
    tracktypes.set(i - 1, tracktypeMatch ? tracktypeMatch[1]! : "unknown");

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

    let bikeroute = "none";
    if (/route_bicycle_icn=yes/.test(tags)) bikeroute = "icn";
    else if (/route_bicycle_ncn=yes/.test(tags)) bikeroute = "ncn";
    else if (/route_bicycle_rcn=yes/.test(tags)) bikeroute = "rcn";
    else if (/route_bicycle_lcn=yes/.test(tags)) bikeroute = "lcn";
    bikeroutes.set(i - 1, bikeroute);
  }
  return { surfaces, highways, maxspeeds, smoothnesses, tracktypes, cycleways, bikeroutes };
}

// Stable pair key for the client-side segment cache. Profile and a hash of
// the no-go polygons are part of the key because both affect BRouter's
// segment output — changing either invalidates every cached pair.
export function pairKey(
  from: Waypoint,
  to: Waypoint,
  profile: string,
  noGoHash: string,
): string {
  return `${from.lon},${from.lat}|${to.lon},${to.lat}|${profile}|${noGoHash}`;
}

export function hashNoGoAreas(noGoAreas?: NoGoArea[]): string {
  if (!noGoAreas || noGoAreas.length === 0) return "";
  // Order and coordinate precision matter: BRouter treats re-ordered
  // polygons the same, but we hash the literal shape to avoid accidental
  // "miss by floating-point drift". djb2 keeps keys short.
  const input = noGoAreas
    .map((a) => a.points.map((p) => `${p.lon},${p.lat}`).join(";"))
    .join("|");
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
