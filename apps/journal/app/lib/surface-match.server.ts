import type { OverpassWay } from "./overpass-ways.server.ts";

/** Squared distance from point P to segment AB, in (degree) units — only used
 * for *comparing* candidates, so the planar approximation is fine at the scale
 * of a route bbox. */
function distToSegmentSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Map-match each route segment to the nearest OSM way and read its
 * surface/highway. `coords` are `[lon, lat, ...]`; returns `surfaces[i]` /
 * `highways[i]` for the segment from `coords[i]` to `coords[i+1]`
 * (length `coords.length - 1`). Segments with no candidate way → `"unknown"`.
 * Feed the result through `computeSurfaceBreakdown` to get the distribution.
 */
export function matchSurfaces(
  coords: ReadonlyArray<readonly number[]>,
  ways: readonly OverpassWay[],
): { surfaces: string[]; highways: string[] } {
  const surfaces: string[] = [];
  const highways: string[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const mx = (a[0]! + b[0]!) / 2; // lon
    const my = (a[1]! + b[1]!) / 2; // lat

    let best: OverpassWay | null = null;
    let bestDist = Infinity;
    for (const way of ways) {
      const g = way.geometry;
      for (let j = 0; j < g.length - 1; j++) {
        const d = distToSegmentSq(mx, my, g[j]!.lon, g[j]!.lat, g[j + 1]!.lon, g[j + 1]!.lat);
        if (d < bestDist) {
          bestDist = d;
          best = way;
        }
      }
    }

    surfaces.push(best?.surface ?? "unknown");
    highways.push(best?.highway ?? "unknown");
  }

  return { surfaces, highways };
}
