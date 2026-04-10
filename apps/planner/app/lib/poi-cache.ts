import type { Poi, BBox } from "./overpass.ts";

const CELL_SIZE = 0.1; // degrees
const TTL = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  pois: Poi[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Quantize a coordinate to the nearest grid cell boundary.
 */
export function quantize(value: number): number {
  return Math.floor(value / CELL_SIZE) * CELL_SIZE;
}

/**
 * Generate cache keys for grid cells covering a bounding box.
 */
export function getCellKeys(bbox: BBox): string[] {
  const keys: string[] = [];
  const minLat = quantize(bbox.south);
  const maxLat = quantize(bbox.north) + CELL_SIZE;
  const minLon = quantize(bbox.west);
  const maxLon = quantize(bbox.east) + CELL_SIZE;

  for (let lat = minLat; lat < maxLat; lat += CELL_SIZE) {
    for (let lon = minLon; lon < maxLon; lon += CELL_SIZE) {
      keys.push(`${lat.toFixed(1)},${lon.toFixed(1)}`);
    }
  }
  return keys;
}

/**
 * Get cached POIs for a bounding box. Returns null if any cell is missing/expired.
 */
export function getCached(bbox: BBox, categoriesKey: string): Poi[] | null {
  const keys = getCellKeys(bbox);
  const now = Date.now();
  const allPois: Poi[] = [];

  for (const cellKey of keys) {
    const fullKey = `${categoriesKey}:${cellKey}`;
    const entry = cache.get(fullKey);
    if (!entry || now - entry.timestamp > TTL) return null;
    allPois.push(...entry.pois);
  }

  // Filter to only POIs actually within the requested bbox
  return allPois.filter(
    (p) => p.lat >= bbox.south && p.lat <= bbox.north && p.lon >= bbox.west && p.lon <= bbox.east,
  );
}

/**
 * Store POIs in the cache, split by grid cell.
 */
export function setCached(bbox: BBox, categoriesKey: string, pois: Poi[]): void {
  const now = Date.now();
  const keys = getCellKeys(bbox);

  // Assign each POI to its grid cell
  const cellPois = new Map<string, Poi[]>();
  for (const key of keys) cellPois.set(key, []);

  for (const poi of pois) {
    const cellKey = `${quantize(poi.lat).toFixed(1)},${quantize(poi.lon).toFixed(1)}`;
    const bucket = cellPois.get(cellKey);
    if (bucket) bucket.push(poi);
  }

  for (const [cellKey, cellData] of cellPois) {
    cache.set(`${categoriesKey}:${cellKey}`, { pois: cellData, timestamp: now });
  }
}

/**
 * Clear all cached data.
 */
export function clearCache(): void {
  cache.clear();
}
