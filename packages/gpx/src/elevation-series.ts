import type { TrackPoint } from "./types.ts";

export interface ElevationSample {
  /** Cumulative distance from start, metres */
  d: number;
  /** Elevation, metres */
  e: number;
  lat: number;
  lng: number;
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
 * Build an elevation series — cumulative distance + elevation + position per
 * sample — for the elevation profile chart and its map↔chart sync. Returns an
 * empty array when the track has fewer than two points carrying elevation
 * (planned routes / imports without elevation), so callers can omit the chart.
 * The result is downsampled to at most `maxPoints` for chart performance, always
 * keeping the first and last sample.
 */
export function elevationSeries(tracks: TrackPoint[][], maxPoints = 400): ElevationSample[] {
  const withEle: TrackPoint[] = [];
  for (const seg of tracks) {
    for (const p of seg) {
      if (typeof p.ele === "number") withEle.push(p);
    }
  }
  if (withEle.length < 2) return [];

  const full: ElevationSample[] = [];
  let cum = 0;
  let prev: TrackPoint | null = null;
  for (const p of withEle) {
    if (prev) cum += haversineMeters(prev.lat, prev.lon, p.lat, p.lon);
    full.push({ d: cum, e: p.ele as number, lat: p.lat, lng: p.lon });
    prev = p;
  }

  if (full.length <= maxPoints) return full;

  // Stride downsample, preserving first and last.
  const stride = Math.ceil(full.length / maxPoints);
  const out: ElevationSample[] = [];
  for (let i = 0; i < full.length; i += stride) out.push(full[i]!);
  const last = full[full.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
