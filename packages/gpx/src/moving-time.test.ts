import { describe, it, expect } from "vitest";
import { movingTime } from "./moving-time.ts";
import type { TrackPoint } from "./types.ts";

// ~0.0001° latitude ≈ 11.1 m. At 11 m per interval, speed depends on dt.
function pt(lat: number, lon: number, time?: string): TrackPoint {
  return { lat, lon, time };
}

describe("movingTime", () => {
  it("returns null when no trackpoints carry timestamps", () => {
    const tracks = [[pt(0, 0), pt(0, 0.0001), pt(0, 0.0002)]];
    expect(movingTime(tracks)).toBeNull();
  });

  it("sums intervals where the athlete is moving", () => {
    // Three points 10s apart, each ~11 m → ~1.1 m/s (moving). 2 intervals.
    const tracks = [[
      pt(0, 0, "2026-06-01T08:00:00Z"),
      pt(0, 0.0001, "2026-06-01T08:00:10Z"),
      pt(0, 0.0002, "2026-06-01T08:00:20Z"),
    ]];
    expect(movingTime(tracks)).toBe(20);
  });

  it("excludes stationary spans (below the speed threshold)", () => {
    // Middle interval: no movement over 10s → stopped, excluded.
    const tracks = [[
      pt(0, 0, "2026-06-01T08:00:00Z"),
      pt(0, 0.0001, "2026-06-01T08:00:10Z"), // moving (~11 m / 10s)
      pt(0, 0.0001, "2026-06-01T08:00:20Z"), // stationary (0 m)
      pt(0, 0.0002, "2026-06-01T08:00:30Z"), // moving again
    ]];
    expect(movingTime(tracks)).toBe(20); // 2 moving intervals of 10s
  });

  it("excludes long gaps (pauses / signal loss)", () => {
    const tracks = [[
      pt(0, 0, "2026-06-01T08:00:00Z"),
      pt(0, 0.0001, "2026-06-01T08:00:10Z"), // 10s moving
      pt(0, 0.0002, "2026-06-01T09:00:00Z"), // ~1h gap → excluded
    ]];
    expect(movingTime(tracks)).toBe(10);
  });

  it("never exceeds elapsed time", () => {
    const tracks = [[
      pt(0, 0, "2026-06-01T08:00:00Z"),
      pt(0, 0.0001, "2026-06-01T08:00:10Z"),
      pt(0, 0.0001, "2026-06-01T08:00:40Z"), // 30s stationary
    ]];
    const elapsed = 40;
    const moving = movingTime(tracks)!;
    expect(moving).toBeLessThanOrEqual(elapsed);
  });
});
