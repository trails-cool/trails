import type { TrackPoint } from "./types.ts";

// Below this speed we treat the athlete as stopped (traffic lights, photo
// stops, regroups). 0.5 m/s ≈ 1.8 km/h — slower than a slow walk.
const STATIONARY_SPEED_MS = 0.5;
// Intervals longer than this are pauses or GPS gaps, not continuous motion;
// they're excluded entirely so a lunch break doesn't inflate moving time.
const MAX_GAP_S = 60;

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
 * Moving time in seconds, derived from trackpoint timestamps: the sum of
 * inter-point intervals during which the athlete was actually moving
 * (excluding stationary spans and long gaps). Returns `null` when the track
 * has no usable timestamps (planned routes, or recordings without time), so
 * callers can fall back to elapsed time. Moving time is always ≤ elapsed.
 */
export function movingTime(tracks: TrackPoint[][]): number | null {
  let movingSeconds = 0;
  let timedIntervals = 0;

  for (const seg of tracks) {
    for (let i = 1; i < seg.length; i++) {
      const prev = seg[i - 1];
      const cur = seg[i];
      if (!prev || !cur || !prev.time || !cur.time) continue;
      const dt = (Date.parse(cur.time) - Date.parse(prev.time)) / 1000;
      if (!Number.isFinite(dt) || dt <= 0 || dt > MAX_GAP_S) continue;
      timedIntervals++;
      const speed = haversineMeters(prev.lat, prev.lon, cur.lat, cur.lon) / dt;
      if (speed >= STATIONARY_SPEED_MS) movingSeconds += dt;
    }
  }

  return timedIntervals > 0 ? Math.round(movingSeconds) : null;
}
