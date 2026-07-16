import type { PoiCategory } from "@trails-cool/map-core";

const POIS_ENDPOINT = "/api/pois";

// Snap bbox coordinates to this grid before requesting so that two users
// looking at nearly-identical viewports produce the same URL and can share a
// browser-cache entry. Expansion is outward (south/west floor, north/east
// ceil) so the user's viewport is always covered. ~0.01° ≈ 1 km at
// mid-latitudes.
const BBOX_GRID_STEP = 0.01;

// Decimals used when formatting the quantized bbox into the request URL.
// 3 decimals → 0.001° precision (~111 m), well below BBOX_GRID_STEP, so the
// string is a stable representation of the quantized cell.
const BBOX_DECIMALS = 3;

export interface Poi {
  id: number;
  lat: number;
  lon: number;
  name?: string;
  category: string;
  tags: Record<string, string>;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Quantize a bbox to the grid defined by `BBOX_GRID_STEP`, expanding outward
 * so the original bbox is fully contained. Returns a new BBox whose
 * coordinates are cell-aligned.
 */
export function quantizeBbox(bbox: BBox, step: number = BBOX_GRID_STEP): BBox {
  return {
    south: Math.floor(bbox.south / step) * step,
    west: Math.floor(bbox.west / step) * step,
    north: Math.ceil(bbox.north / step) * step,
    east: Math.ceil(bbox.east / step) * step,
  };
}

/**
 * Build the `/api/pois` query string for a bbox + categories. The bbox is
 * quantized and formatted with fixed decimals so near-identical viewports
 * produce a byte-identical URL — which the browser cache keys on.
 */
export function buildPoisQuery(bbox: BBox, categories: PoiCategory[]): string {
  const q = quantizeBbox(bbox);
  const bboxStr = [q.south, q.west, q.north, q.east]
    .map((n) => n.toFixed(BBOX_DECIMALS))
    .join(",");
  const cats = categories.map((c) => c.id).join(",");
  return `bbox=${bboxStr}&categories=${encodeURIComponent(cats)}`;
}

/**
 * Deduplicate POIs by OSM id (an element in two enabled categories comes back
 * once per category; the map shows a single marker for it).
 */
export function deduplicateById(pois: Poi[]): Poi[] {
  const seen = new Set<number>();
  return pois.filter((poi) => {
    if (seen.has(poi.id)) return false;
    seen.add(poi.id);
    return true;
  });
}

/**
 * Query the instance's own POI index for POIs within a bounding box.
 *
 * All requests go to the Planner's `/api/pois` endpoint, which enforces
 * same-origin + session binding and a per-IP rate limit, and serves from the
 * local PostGIS index. No POI request ever leaves trails.cool infrastructure.
 */
export async function queryPois(
  bbox: BBox,
  categories: PoiCategory[],
  sessionId: string,
  signal?: AbortSignal,
): Promise<Poi[]> {
  if (categories.length === 0) return [];

  const response = await fetch(`${POIS_ENDPOINT}?${buildPoisQuery(bbox, categories)}`, {
    method: "GET",
    headers: {
      // Bind this call to the active planner session so the endpoint isn't
      // anonymously reachable.
      "X-Trails-Session": sessionId,
    },
    signal,
  });

  if (response.status === 429) {
    throw new PoiRateLimitError();
  }

  if (!response.ok) {
    throw new Error(`POI service error: ${response.status}`);
  }

  let data: { pois?: Poi[] };
  try {
    data = await response.json();
  } catch {
    throw new Error("POI service returned invalid JSON");
  }

  return deduplicateById(data.pois ?? []);
}

export class PoiRateLimitError extends Error {
  constructor() {
    super("POI service rate limit exceeded");
    this.name = "PoiRateLimitError";
  }
}

// Degrees of latitude per meter (approximate, valid globally).
const DEG_PER_METER_LAT = 1 / 111320;

/**
 * Fetch POIs within `radiusMeters` of a coordinate.
 * Builds a bbox around the point and reuses queryPois + the `/api/pois` route.
 */
export async function fetchNearbyPois(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: PoiCategory[],
  sessionId: string,
  signal?: AbortSignal,
): Promise<Poi[]> {
  const dLat = radiusMeters * DEG_PER_METER_LAT;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const bbox: BBox = {
    south: lat - dLat,
    north: lat + dLat,
    west: lon - dLon,
    east: lon + dLon,
  };
  return queryPois(bbox, categories, sessionId, signal);
}
