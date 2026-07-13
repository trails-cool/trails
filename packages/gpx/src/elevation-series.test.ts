import { describe, it, expect } from "vitest";
import { elevationSeries } from "./elevation-series.ts";
import type { TrackPoint } from "./types.ts";

function pt(lat: number, lon: number, ele?: number): TrackPoint {
  return { lat, lon, ele };
}

describe("elevationSeries", () => {
  it("returns empty when fewer than two points carry elevation", () => {
    expect(elevationSeries([[pt(0, 0), pt(0, 0.001)]])).toEqual([]);
    expect(elevationSeries([[pt(0, 0, 100)]])).toEqual([]);
  });

  it("builds cumulative distance, elevation and position", () => {
    const s = elevationSeries([[pt(0, 0, 100), pt(0, 0.001, 110), pt(0, 0.002, 105)]]);
    expect(s).toHaveLength(3);
    expect(s[0]!.d).toBe(0);
    expect(s[0]!.e).toBe(100);
    expect(s[1]!.d).toBeGreaterThan(0);
    expect(s[2]!.d).toBeGreaterThan(s[1]!.d);
    expect(s[2]!.e).toBe(105);
    expect(s[0]!.lat).toBe(0);
  });

  it("flattens multiple track segments", () => {
    const s = elevationSeries([
      [pt(0, 0, 100), pt(0, 0.001, 110)],
      [pt(0, 0.002, 120), pt(0, 0.003, 130)],
    ]);
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.e)).toEqual([100, 110, 120, 130]);
  });

  it("downsamples to at most maxPoints, keeping first and last", () => {
    const seg: TrackPoint[] = [];
    for (let i = 0; i < 1000; i++) seg.push(pt(0, i * 0.0001, 100 + i));
    const s = elevationSeries([seg], 100);
    expect(s.length).toBeLessThanOrEqual(101);
    expect(s[0]!.e).toBe(100);
    expect(s[s.length - 1]!.e).toBe(1099);
  });

  it("despikes so the chart agrees with the cleaned stats (no spike survives)", () => {
    // Same shape as parse.test.ts's noisy track: a 300 m single-point spike
    // between two ~110 m points must be interpolated out of the chart series.
    const eles = [100, 104, 101, 110, 300, 112, 118, 115, 122, 130];
    const seg = eles.map((e, i) => pt(47 + i * 0.001, 8.5, e));
    const s = elevationSeries([seg]);
    expect(s).toHaveLength(eles.length);
    expect(Math.max(...s.map((x) => x.e))).toBeLessThan(200); // spike gone
    expect(s[0]!.e).toBe(100); // endpoints untouched
    expect(s[s.length - 1]!.e).toBe(130);
  });

  it("does not interpolate a spike across a segment boundary", () => {
    // A lone point that would look like a spike only if joined to the next
    // segment must be left alone — despiking is per segment.
    const s = elevationSeries([[pt(47, 8.5, 100), pt(47.001, 8.5, 500)], [pt(47.002, 8.5, 100), pt(47.003, 8.5, 110)]]);
    // The 500 m point is an endpoint of its own segment → never despiked.
    expect(s.some((x) => x.e === 500)).toBe(true);
  });
});
