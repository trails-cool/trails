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
});
