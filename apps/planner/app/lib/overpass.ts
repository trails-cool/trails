import type { PoiCategory } from "@trails-cool/map-core";

const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

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
 * Build an Overpass QL query combining all enabled categories into a union.
 */
export function buildQuery(bbox: BBox, categories: PoiCategory[]): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
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
 */
export async function queryPois(
  bbox: BBox,
  categories: PoiCategory[],
  signal?: AbortSignal,
): Promise<Poi[]> {
  if (categories.length === 0) return [];

  const query = buildQuery(bbox, categories);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await fetchFromEndpoint(endpoint, query, categories, signal);
    } catch (err) {
      // If aborted, don't try fallback
      if (signal?.aborted) throw err;
      // If rate limited on all endpoints, throw
      if (err instanceof OverpassRateLimitError && endpoint === OVERPASS_ENDPOINTS[OVERPASS_ENDPOINTS.length - 1]) throw err;
      // Try next endpoint
      if (endpoint !== OVERPASS_ENDPOINTS[OVERPASS_ENDPOINTS.length - 1]) continue;
      throw err;
    }
  }

  return [];
}

async function fetchFromEndpoint(
  endpoint: string,
  query: string,
  categories: PoiCategory[],
  signal?: AbortSignal,
): Promise<Poi[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
