import type { TrackPoint } from "./types.ts";
import { despike } from "./elevation-clean.ts";

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
  // Elevation-bearing points, tagged with their segment so despiking never
  // interpolates across a trkseg gap.
  const withEle: Array<{ p: TrackPoint; seg: number }> = [];
  tracks.forEach((seg, si) => {
    for (const p of seg) if (typeof p.ele === "number") withEle.push({ p, seg: si });
  });
  if (withEle.length < 2) return [];

  // Cumulative distance across consecutive elevation points (chart x-axis).
  const dists: number[] = [];
  let cum = 0;
  for (let i = 0; i < withEle.length; i++) {
    if (i > 0) {
      cum += haversineMeters(
        withEle[i - 1]!.p.lat, withEle[i - 1]!.p.lon, withEle[i]!.p.lat, withEle[i]!.p.lon,
      );
    }
    dists.push(cum);
  }

  // Despike each segment's slice so the chart matches the headline stats
  // (spec: elevation-profile-hardening). Only elevation is cleaned; distance
  // and position are untouched.
  const cleanE = new Array<number>(withEle.length);
  for (let start = 0; start < withEle.length; ) {
    let end = start;
    while (end + 1 < withEle.length && withEle[end + 1]!.seg === withEle[start]!.seg) end++;
    const cleaned = despike(
      withEle.slice(start, end + 1).map((x, i) => ({ distance: dists[start + i]!, elevation: x.p.ele as number })),
    );
    for (let i = 0; i < cleaned.length; i++) cleanE[start + i] = cleaned[i]!.elevation;
    start = end + 1;
  }

  const full: ElevationSample[] = withEle.map((x, i) => ({
    d: dists[i]!,
    e: cleanE[i]!,
    lat: x.p.lat,
    lng: x.p.lon,
  }));

  if (full.length <= maxPoints) return full;

  // Stride downsample, preserving first and last.
  const stride = Math.ceil(full.length / maxPoints);
  const out: ElevationSample[] = [];
  for (let i = 0; i < full.length; i += stride) out.push(full[i]!);
  const last = full[full.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
