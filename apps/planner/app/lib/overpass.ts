import type { PoiCategory } from "@trails-cool/map-core";

const OVERPASS_PROXY = "/api/overpass";

// Snap bbox coordinates to this grid before building the query so that two
// users looking at nearly-identical viewports produce byte-identical queries
// and therefore share a server-side cache entry. Expansion is outward
// (south/west floor, north/east ceil) so the user's viewport is always
// covered. ~0.01° ≈ 1 km at mid-latitudes.
const BBOX_GRID_STEP = 0.01;

// Decimals used when formatting the quantized bbox into the query string.
// 3 decimals → 0.001° precision (~111 m) which is well below BBOX_GRID_STEP,
// so the string is a stable representation of the quantized cell.
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
 * Build an Overpass QL query combining all enabled categories into a union.
 * The bbox is quantized to a fixed grid and formatted with a fixed number of
 * decimals so near-identical viewports produce a byte-identical query — which
 * the `/api/overpass` server-side cache keys on.
 */
export function buildQuery(bbox: BBox, categories: PoiCategory[]): string {
  const q = quantizeBbox(bbox);
  const bboxStr = [q.south, q.west, q.north, q.east]
    .map((n) => n.toFixed(BBOX_DECIMALS))
    .join(",");
  const unions = categories.map((c) => c.query).join("");
  return `[out:json][timeout:10][maxsize:1048576][bbox:${bboxStr}];(${unions});out center qt 100;`;
}

/**
 * Parse Overpass JSON response into typed Poi objects.
 */
export function parseResponse(
  data: { elements: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }> },
  categories: PoiCategory[],
): Poi[] {
  const pois: Poi[] = [];

  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;

    const tags = el.tags ?? {};
    const category = matchCategory(tags, categories);
    if (!category) continue;

    pois.push({
      id: el.id,
      lat,
      lon,
      name: tags.name,
      category: category.id,
      tags,
    });
  }

  return deduplicateById(pois);
}

/**
 * Match an element's tags to the first matching category.
 */
function matchCategory(tags: Record<string, string>, categories: PoiCategory[]): PoiCategory | null {
  for (const cat of categories) {
    // Parse query fragments like 'nwr["amenity"="drinking_water"];'
    const fragments = cat.query.split(";").filter(Boolean);
    for (const frag of fragments) {
      const match = frag.match(/\["(\w+)"="([^"]+)"\]/);
      if (match && tags[match[1]!] === match[2]) return cat;
    }
  }
  return null;
}

/**
 * Deduplicate POIs by OSM node ID (same node may match multiple queries).
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
 * Query the Overpass API for POIs within a bounding box.
 *
 * All queries route through the Planner's own `/api/overpass` proxy, which
 * adds a User-Agent identifying trails.cool, rate-limits per IP, and enforces
 * same-origin. The client never talks to a public Overpass host directly.
 */
export async function queryPois(
  bbox: BBox,
  categories: PoiCategory[],
  sessionId: string,
  signal?: AbortSignal,
): Promise<Poi[]> {
  if (categories.length === 0) return [];

  const query = buildQuery(bbox, categories);

  const response = await fetch(OVERPASS_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Bind this call to the active planner session so the proxy
      // isn't anonymously reachable.
      "X-Trails-Session": sessionId,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (response.status === 429) {
    throw new OverpassRateLimitError();
  }

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const text = await response.text();

  if (text.includes("rate_limited")) {
    throw new OverpassRateLimitError();
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Overpass API returned invalid JSON");
  }

  return parseResponse(data, categories);
}

export class OverpassRateLimitError extends Error {
  constructor() {
    super("Overpass API rate limit exceeded");
    this.name = "OverpassRateLimitError";
  }
}
