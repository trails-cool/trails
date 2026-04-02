import type { GpxData } from "./types.ts";

/**
 * Extract waypoints from parsed GPX data.
 * Uses explicit <wpt> elements if present, otherwise extracts the start
 * of each track segment + end of the last segment.
 */
export function extractWaypoints(gpxData: GpxData): Array<{ lat: number; lon: number; name?: string }> {
  if (gpxData.waypoints.length > 0) return gpxData.waypoints;
  if (gpxData.tracks.length === 0) return [];

  const result: Array<{ lat: number; lon: number }> = [];
  for (const seg of gpxData.tracks) {
    if (seg.length === 0) continue;
    const first = seg[0]!;
    const prev = result[result.length - 1];
    if (!prev || prev.lat !== first.lat || prev.lon !== first.lon) {
      result.push({ lat: first.lat, lon: first.lon });
    }
  }

  // Add end of last segment
  const lastSeg = gpxData.tracks[gpxData.tracks.length - 1]!;
  if (lastSeg.length > 0) {
    const last = lastSeg[lastSeg.length - 1]!;
    const prev = result[result.length - 1];
    if (!prev || prev.lat !== last.lat || prev.lon !== last.lon) {
      result.push({ lat: last.lat, lon: last.lon });
    }
  }

  return result;
}
