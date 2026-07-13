import { describe, it, expect } from "vitest";
import { repairSegmentTimestamps } from "./timestamp-repair.ts";
import { movingTime } from "./moving-time.ts";
import type { TrackPoint } from "./types.ts";

const pt = (time?: string, lat = 52.5, lon = 13.4): TrackPoint => ({ lat, lon, time });

describe("repairSegmentTimestamps", () => {
  it("interpolates a sparse invalid timestamp between valid neighbours", () => {
    const out = repairSegmentTimestamps([
      pt("2026-01-01T10:00:00Z"),
      pt("garbage"),
      pt("2026-01-01T10:02:00Z"),
      pt("2026-01-01T10:03:00Z"),
    ]);
    // index 1 is midway (by index) between valid index 0 and index 2.
    expect(out[1]!.time).toBe("2026-01-01T10:01:00.000Z");
    // Valid points keep their original strings untouched.
    expect(out[0]!.time).toBe("2026-01-01T10:00:00Z");
    expect(out[3]!.time).toBe("2026-01-01T10:03:00Z");
  });

  it("drops all timestamps when more than half the segment is invalid", () => {
    const out = repairSegmentTimestamps([
      pt("2026-01-01T10:00:00Z"),
      pt("garbage"),
      pt(undefined),
      pt("nope"),
    ]);
    expect(out.every((p) => p.time === undefined)).toBe(true);
    // A dropped time channel means the segment reads as untimed.
    expect(movingTime([out])).toBeNull();
  });

  it("clamps leading and trailing invalid runs to the nearest valid timestamp", () => {
    const out = repairSegmentTimestamps([
      pt("garbage"),
      pt("2026-01-01T10:01:00Z"),
      pt("2026-01-01T10:02:00Z"),
      pt(undefined),
    ]);
    expect(out[0]!.time).toBe("2026-01-01T10:01:00.000Z"); // leading clamp
    expect(out[3]!.time).toBe("2026-01-01T10:02:00.000Z"); // trailing clamp
  });

  it("leaves an all-valid segment untouched", () => {
    const input = [pt("2026-01-01T10:00:00Z"), pt("2026-01-01T10:01:00Z")];
    const out = repairSegmentTimestamps(input);
    expect(out.map((p) => p.time)).toEqual(["2026-01-01T10:00:00Z", "2026-01-01T10:01:00Z"]);
  });

  it("leaves an untimed segment (no timestamps) untouched", () => {
    const out = repairSegmentTimestamps([pt(undefined), pt(undefined), pt(undefined)]);
    expect(out.every((p) => p.time === undefined)).toBe(true);
  });
});
