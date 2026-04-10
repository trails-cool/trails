import type { Waypoint } from "@trails-cool/types";
import type { TrackPoint } from "./types.ts";

export interface DayStage {
  dayNumber: number;
  startWaypointIndex: number;
  endWaypointIndex: number;
  startName?: string;
  endName?: string;
  /** Distance in meters */
  distance: number;
  /** Ascent in meters */
  ascent: number;
  /** Descent in meters */
  descent: number;
}

/**
 * Split a route into day stages based on waypoints with isDayBreak.
 *
 * Day boundaries are defined by waypoints where isDayBreak is true.
 * The first waypoint is the implicit start of Day 1, the last waypoint
 * is the implicit end of the final day, and each isDayBreak waypoint
 * marks the end of one day and the start of the next.
 *
 * If no waypoints have isDayBreak, returns a single day covering the
 * entire route.
 */
export function computeDays(
  waypoints: Waypoint[],
  tracks: TrackPoint[][],
): DayStage[] {
  if (waypoints.length === 0 || tracks.length === 0) return [];

  // Flatten all tracks into a single point array
  const allPoints: TrackPoint[] = tracks.flat();
  if (allPoints.length === 0) return [];

  // Find waypoint indices that are day breaks
  const breakIndices: number[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    if (waypoints[i]!.isDayBreak) {
      breakIndices.push(i);
    }
  }

  // Build day boundaries: [0, break1, break2, ..., lastWaypointIndex]
  const boundaries = [0, ...breakIndices];
  if (boundaries[boundaries.length - 1] !== waypoints.length - 1) {
    boundaries.push(waypoints.length - 1);
  }

  // For each waypoint, find the closest point in the track
  const waypointTrackIndices = waypoints.map((wp) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < allPoints.length; i++) {
      const dx = allPoints[i]!.lat - wp.lat;
      const dy = allPoints[i]!.lon - wp.lon;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  // Precompute cumulative distances and elevation changes
  const cumDist: number[] = [0];
  const cumAscent: number[] = [0];
  const cumDescent: number[] = [0];

  for (let i = 1; i < allPoints.length; i++) {
    const prev = allPoints[i - 1]!;
    const curr = allPoints[i]!;
    cumDist.push(cumDist[i - 1]! + haversine(prev.lat, prev.lon, curr.lat, curr.lon));

    if (prev.ele !== undefined && curr.ele !== undefined) {
      const diff = curr.ele - prev.ele;
      cumAscent.push(cumAscent[i - 1]! + (diff > 0 ? diff : 0));
      cumDescent.push(cumDescent[i - 1]! + (diff < 0 ? -diff : 0));
    } else {
      cumAscent.push(cumAscent[i - 1]!);
      cumDescent.push(cumDescent[i - 1]!);
    }
  }

  // Build day stages
  const days: DayStage[] = [];
  for (let d = 0; d < boundaries.length - 1; d++) {
    const startWpIdx = boundaries[d]!;
    const endWpIdx = boundaries[d + 1]!;
    const startTrackIdx = waypointTrackIndices[startWpIdx]!;
    const endTrackIdx = waypointTrackIndices[endWpIdx]!;

    days.push({
      dayNumber: d + 1,
      startWaypointIndex: startWpIdx,
      endWaypointIndex: endWpIdx,
      startName: waypoints[startWpIdx]!.name,
      endName: waypoints[endWpIdx]!.name,
      distance: Math.round(cumDist[endTrackIdx]! - cumDist[startTrackIdx]!),
      ascent: Math.round(cumAscent[endTrackIdx]! - cumAscent[startTrackIdx]!),
      descent: Math.round(cumDescent[endTrackIdx]! - cumDescent[startTrackIdx]!),
    });
  }

  return days;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
