import { describe, it, expect } from "vitest";
import {
  formatDistanceKm,
  formatElevationM,
  formatDuration,
  formatSpeedKmh,
  formatPace,
  deriveRate,
  activityStatItems,
} from "./stats.ts";

// Identity translate: labels come back as their keys so we can assert order.
const t = (k: string) => k;

describe("formatters", () => {
  it("formats distance (1 decimal under 100 km, integer above)", () => {
    expect(formatDistanceKm(12_340)).toBe("12.3 km");
    expect(formatDistanceKm(123_400)).toBe("123 km");
  });
  it("formats elevation as integer metres", () => {
    expect(formatElevationM(512.6)).toBe("513 m");
  });
  it("formats duration h/m", () => {
    expect(formatDuration(9000)).toBe("2h 30m");
    expect(formatDuration(2820)).toBe("47m");
  });
  it("formats speed and pace", () => {
    expect(formatSpeedKmh(30.86)).toBe("30.9 km/h");
    expect(formatPace(318)).toBe("5:18 /km");
  });
});

describe("deriveRate", () => {
  it("returns pace for foot sports", () => {
    expect(deriveRate(10_000, 3000, "run")).toEqual({ kind: "pace", value: 300 });
    expect(deriveRate(10_000, 3000, "hike")?.kind).toBe("pace");
  });
  it("returns speed for wheeled/ski sports", () => {
    expect(deriveRate(30_000, 3600, "ride")).toEqual({ kind: "speed", value: 30 });
    expect(deriveRate(1000, 3600, "mtb")?.kind).toBe("speed");
  });
  it("defaults to speed when sport is unset", () => {
    expect(deriveRate(30_000, 3600, null)?.kind).toBe("speed");
  });
  it("returns null without usable distance/time", () => {
    expect(deriveRate(0, 3600, "run")).toBeNull();
    expect(deriveRate(1000, 0, "run")).toBeNull();
    expect(deriveRate(null, null, "run")).toBeNull();
  });
});

describe("activityStatItems", () => {
  it("builds the full canonical order", () => {
    const items = activityStatItems(
      {
        distance: 30_000,
        durationSec: 3600,
        movingTimeSec: 3300,
        elevationGain: 500,
        elevationLoss: 480,
        sportType: "ride",
      },
      t,
    );
    expect(items.map((i) => i.label)).toEqual([
      "stats.distance",
      "stats.duration",
      "stats.movingTime",
      "stats.avgSpeed",
      "stats.ascent",
      "stats.descent",
    ]);
  });

  it("compact drops moving time and ascent/descent, keeps order", () => {
    const items = activityStatItems(
      { distance: 10_000, durationSec: 3000, movingTimeSec: 2800, elevationGain: 100, sportType: "run" },
      t,
      { compact: true },
    );
    expect(items.map((i) => i.label)).toEqual([
      "stats.distance",
      "stats.duration",
      "stats.avgPace",
    ]);
  });

  it("omits items with no value", () => {
    const items = activityStatItems({ distance: 5000 }, t);
    expect(items.map((i) => i.label)).toEqual(["stats.distance"]);
  });

  it("rate prefers moving time over elapsed", () => {
    const items = activityStatItems(
      { distance: 10_000, durationSec: 4000, movingTimeSec: 3000, sportType: "run" },
      t,
    );
    const pace = items.find((i) => i.label === "stats.avgPace");
    // 10 km in 3000s moving → 5:00 /km (not 6:40 from elapsed)
    expect(pace?.value).toBe("5:00 /km");
  });
});
