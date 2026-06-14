/**
 * Distance-weighted surface / waytype breakdown for a route. Both derivation
 * paths (BRouter waytags at Planner save, and the async Overpass backfill) feed
 * their per-segment `surfaces`/`highways` arrays through this to produce the
 * same compact summary that gets stored and rendered.
 */
export interface SurfaceBreakdown {
  /** metres per surface category (e.g. asphalt, gravel, path) */
  surface: Record<string, number>;
  /** metres per waytype/highway category */
  highway: Record<string, number>;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sum each coordinate segment's length into its surface and waytype buckets.
 * `coordinates` are `[lon, lat, ...]` (GeoJSON axis order); `surfaces[i]` /
 * `highways[i]` describe the segment from point `i` to `i+1`. Missing/empty
 * values bucket as `"unknown"`. Returns metres per category.
 */
export function computeSurfaceBreakdown(
  coordinates: ReadonlyArray<readonly number[]>,
  surfaces: readonly string[],
  highways: readonly string[],
): SurfaceBreakdown {
  const surface: Record<string, number> = {};
  const highway: Record<string, number> = {};

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const d = haversineMeters(a[1]!, a[0]!, b[1]!, b[0]!);
    if (!(d > 0)) continue;
    const s = surfaces[i] || "unknown";
    const h = highways[i] || "unknown";
    surface[s] = (surface[s] ?? 0) + d;
    highway[h] = (highway[h] ?? 0) + d;
  }

  return { surface, highway };
}
