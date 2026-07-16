import type { LatLngExpression } from "leaflet";

export interface ColorRun {
  positions: LatLngExpression[];
  color: string;
}

/**
 * Run-length group a route's segments into one polyline per contiguous run of
 * the same color, instead of one polyline per coordinate pair. `colorAt(i)`
 * returns the color of segment i (between coordinate i and i+1). Turns ~1
 * polyline/coordinate (tens of thousands on a long route) into a handful, so
 * Leaflet's SVG layer and event system aren't flooded. Rendering is otherwise
 * identical: each run is a polyline through all its points in the run color.
 *
 * Coordinates are [lon, lat, ele]; positions are emitted as [lat, lon].
 * Consecutive runs share their boundary point so the line stays continuous.
 */
export function buildColorRuns(
  coordinates: [number, number, number][],
  colorAt: (segmentIndex: number) => string,
): ColorRun[] {
  const n = coordinates.length;
  if (n < 2) return [];
  const pt = (i: number): LatLngExpression => [coordinates[i]![1], coordinates[i]![0]];
  const runs: ColorRun[] = [];
  let start = 0;
  let color = colorAt(0);
  const pushRun = (from: number, toPoint: number, c: string) => {
    const positions: LatLngExpression[] = [];
    for (let j = from; j <= toPoint; j++) positions.push(pt(j));
    runs.push({ positions, color: c });
  };
  for (let seg = 1; seg <= n - 2; seg++) {
    const c = colorAt(seg);
    if (c !== color) {
      pushRun(start, seg, color); // segments [start..seg-1] → points [start..seg]
      start = seg;
      color = c;
    }
  }
  pushRun(start, n - 1, color); // final run → last point
  return runs;
}
