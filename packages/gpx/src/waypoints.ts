import type { GpxData } from "./types.ts";

/**
 * Extract waypoints from parsed GPX data.
 * Uses explicit <wpt> elements if present, otherwise simplifies the
 * track using Douglas-Peucker to find significant turning points.
 */
export function extractWaypoints(gpxData: GpxData): Array<{ lat: number; lon: number; name?: string }> {
  if (gpxData.waypoints.length > 0) return gpxData.waypoints;
  if (gpxData.tracks.length === 0) return [];

  // Collect start of each segment + end of last (for multi-segment GPX)
  const segmentEndpoints: Array<{ lat: number; lon: number }> = [];
  for (const seg of gpxData.tracks) {
    if (seg.length === 0) continue;
    const first = seg[0]!;
    const prev = segmentEndpoints[segmentEndpoints.length - 1];
    if (!prev || prev.lat !== first.lat || prev.lon !== first.lon) {
      segmentEndpoints.push({ lat: first.lat, lon: first.lon });
    }
  }
  const lastSeg = gpxData.tracks[gpxData.tracks.length - 1]!;
  if (lastSeg.length > 0) {
    const last = lastSeg[lastSeg.length - 1]!;
    const prev = segmentEndpoints[segmentEndpoints.length - 1];
    if (!prev || prev.lat !== last.lat || prev.lon !== last.lon) {
      segmentEndpoints.push({ lat: last.lat, lon: last.lon });
    }
  }

  // If multi-segment already gives us enough waypoints, use those
  if (segmentEndpoints.length > 2) return segmentEndpoints;

  // Single segment: simplify the track to find key turning points
  const allPoints = gpxData.tracks.flat().map((p) => ({ lat: p.lat, lon: p.lon }));
  if (allPoints.length < 2) return allPoints;

  return douglasPeucker(allPoints, 0.005);
}

/**
 * Douglas-Peucker line simplification.
 * Epsilon is in degrees (~0.005° ≈ 500m at mid-latitudes).
 * Recursively finds the point with maximum perpendicular distance
 * from the line between start and end, keeping significant turns.
 */
function douglasPeucker(
  points: Array<{ lat: number; lon: number }>,
  epsilon: number,
): Array<{ lat: number; lon: number }> {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const start = points[0]!;
  const end = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i]!, start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: { lat: number; lon: number },
  lineStart: { lat: number; lon: number },
  lineEnd: { lat: number; lon: number },
): number {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const px = point.lon - lineStart.lon;
    const py = point.lat - lineStart.lat;
    return Math.sqrt(px * px + py * py);
  }
  const t = Math.max(0, Math.min(1,
    ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) / lenSq,
  ));
  const projLon = lineStart.lon + t * dx;
  const projLat = lineStart.lat + t * dy;
  const px = point.lon - projLon;
  const py = point.lat - projLat;
  return Math.sqrt(px * px + py * py);
}
