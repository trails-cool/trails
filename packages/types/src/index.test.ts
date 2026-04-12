import { describe, it, expect } from "vitest";
import type { Waypoint } from "./index.ts";

describe("types", () => {
  it("Waypoint type accepts valid data", () => {
    const waypoint: Waypoint = { lat: 52.52, lon: 13.405 };
    expect(waypoint.lat).toBe(52.52);
    expect(waypoint.lon).toBe(13.405);
  });

  it("Waypoint supports isDayBreak flag", () => {
    const waypoint: Waypoint = { lat: 48.137, lon: 11.576, name: "Munich", isDayBreak: true };
    expect(waypoint.isDayBreak).toBe(true);
  });
});
