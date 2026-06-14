import { describe, it, expect } from "vitest";
import { computeSurfaceBreakdown } from "./surface-breakdown.ts";

// ~0.001° lon at the equator ≈ 111 m; exact value doesn't matter, only ratios.
const coords: [number, number][] = [
  [0, 0],
  [0.001, 0],
  [0.002, 0],
  [0.003, 0],
];

describe("computeSurfaceBreakdown", () => {
  it("weights segments by distance into surface and waytype buckets", () => {
    const { surface, highway } = computeSurfaceBreakdown(
      coords,
      ["asphalt", "asphalt", "gravel"],
      ["residential", "residential", "track"],
    );
    // segments 0,1 asphalt; segment 2 gravel — equal lengths → 2:1
    expect(surface.asphalt! / surface.gravel!).toBeCloseTo(2, 5);
    expect(highway.residential! / highway.track!).toBeCloseTo(2, 5);
    expect(Object.keys(surface)).toEqual(["asphalt", "gravel"]);
  });

  it("buckets missing/empty values as unknown", () => {
    const { surface } = computeSurfaceBreakdown(coords, ["asphalt", "", "asphalt"], ["", "", ""]);
    expect(surface.asphalt).toBeGreaterThan(0);
    expect(surface.unknown).toBeGreaterThan(0);
  });

  it("returns empty buckets for a degenerate track", () => {
    expect(computeSurfaceBreakdown([[0, 0]], [], [])).toEqual({ surface: {}, highway: {} });
  });
});
