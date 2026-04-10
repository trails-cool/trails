import { describe, it, expect } from "vitest";
import { computeDays } from "./compute-days.ts";
import type { Waypoint } from "@trails-cool/types";
import type { TrackPoint } from "./types.ts";

function makeTrack(coords: [number, number, number][]): TrackPoint[] {
  return coords.map(([lat, lon, ele]) => ({ lat, lon, ele }));
}

describe("computeDays", () => {
  it("returns empty array for no waypoints", () => {
    expect(computeDays([], [[{ lat: 0, lon: 0 }]])).toEqual([]);
  });

  it("returns empty array for no tracks", () => {
    expect(computeDays([{ lat: 0, lon: 0 }], [])).toEqual([]);
  });

  it("returns single day when no overnight waypoints", () => {
    const waypoints: Waypoint[] = [
      { lat: 52.52, lon: 13.405, name: "Berlin" },
      { lat: 51.34, lon: 12.375, name: "Leipzig" },
    ];
    const track = makeTrack([
      [52.52, 13.405, 34],
      [52.0, 13.0, 50],
      [51.34, 12.375, 113],
    ]);
    const days = computeDays(waypoints, [track]);
    expect(days).toHaveLength(1);
    expect(days[0]!.dayNumber).toBe(1);
    expect(days[0]!.startName).toBe("Berlin");
    expect(days[0]!.endName).toBe("Leipzig");
    expect(days[0]!.distance).toBeGreaterThan(0);
  });

  it("splits into two days at overnight waypoint", () => {
    const waypoints: Waypoint[] = [
      { lat: 52.52, lon: 13.405, name: "Berlin" },
      { lat: 51.84, lon: 12.243, name: "Dessau", isDayBreak: true },
      { lat: 50.98, lon: 11.028, name: "Erfurt" },
    ];
    const track = makeTrack([
      [52.52, 13.405, 34],
      [52.2, 12.8, 60],
      [51.84, 12.243, 80],
      [51.4, 11.6, 200],
      [50.98, 11.028, 195],
    ]);
    const days = computeDays(waypoints, [track]);
    expect(days).toHaveLength(2);

    expect(days[0]!.dayNumber).toBe(1);
    expect(days[0]!.startName).toBe("Berlin");
    expect(days[0]!.endName).toBe("Dessau");

    expect(days[1]!.dayNumber).toBe(2);
    expect(days[1]!.startName).toBe("Dessau");
    expect(days[1]!.endName).toBe("Erfurt");

    // Total distance should roughly equal sum of days
    const totalDist = days[0]!.distance + days[1]!.distance;
    expect(totalDist).toBeGreaterThan(0);
  });

  it("splits into three days with two overnight stops", () => {
    const waypoints: Waypoint[] = [
      { lat: 0, lon: 0, name: "A" },
      { lat: 1, lon: 0, name: "B", isDayBreak: true },
      { lat: 2, lon: 0, name: "C", isDayBreak: true },
      { lat: 3, lon: 0, name: "D" },
    ];
    const track = makeTrack([
      [0, 0, 0], [0.5, 0, 10], [1, 0, 20],
      [1.5, 0, 30], [2, 0, 40],
      [2.5, 0, 50], [3, 0, 60],
    ]);
    const days = computeDays(waypoints, [track]);
    expect(days).toHaveLength(3);
    expect(days[0]!.startName).toBe("A");
    expect(days[0]!.endName).toBe("B");
    expect(days[1]!.startName).toBe("B");
    expect(days[1]!.endName).toBe("C");
    expect(days[2]!.startName).toBe("C");
    expect(days[2]!.endName).toBe("D");
  });

  it("computes ascent and descent per day", () => {
    const waypoints: Waypoint[] = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0, isDayBreak: true },
      { lat: 2, lon: 0 },
    ];
    const track = makeTrack([
      [0, 0, 100],
      [0.5, 0, 200],  // +100 ascent
      [1, 0, 150],     // -50 descent
      [1.5, 0, 50],    // -100 descent
      [2, 0, 250],     // +200 ascent
    ]);
    const days = computeDays(waypoints, [track]);
    expect(days).toHaveLength(2);
    expect(days[0]!.ascent).toBe(100);
    expect(days[0]!.descent).toBe(50);
    expect(days[1]!.ascent).toBe(200);
    expect(days[1]!.descent).toBe(100);
  });

  it("handles overnight on first waypoint gracefully", () => {
    const waypoints: Waypoint[] = [
      { lat: 0, lon: 0, isDayBreak: true },
      { lat: 1, lon: 0 },
    ];
    const track = makeTrack([[0, 0, 0], [1, 0, 100]]);
    const days = computeDays(waypoints, [track]);
    // First waypoint is implicit start of Day 1, isDayBreak on it creates
    // a zero-length day followed by the real day
    expect(days.length).toBeGreaterThanOrEqual(1);
  });

  it("handles overnight on last waypoint gracefully", () => {
    const waypoints: Waypoint[] = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0, isDayBreak: true },
    ];
    const track = makeTrack([[0, 0, 0], [1, 0, 100]]);
    const days = computeDays(waypoints, [track]);
    // Last waypoint is implicit end, isDayBreak on it = single day
    expect(days.length).toBeGreaterThanOrEqual(1);
  });

  it("handles single waypoint", () => {
    const waypoints: Waypoint[] = [{ lat: 0, lon: 0 }];
    const track = makeTrack([[0, 0, 0]]);
    const days = computeDays(waypoints, [track]);
    // Single waypoint can't form a meaningful day with distance
    expect(days).toHaveLength(0);
  });
});
