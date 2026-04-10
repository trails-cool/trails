import { describe, it, expect } from "vitest";
import { generateGpx } from "./generate.ts";
import { parseGpxAsync } from "./parse.ts";

/**
 * Tests the dayBreaks extraction pattern used by the Journal's updateRoute:
 * parse GPX → find waypoints with isDayBreak → extract indices
 */
describe("dayBreaks extraction from GPX", () => {
  it("extracts empty dayBreaks when no overnight waypoints", async () => {
    const gpx = generateGpx({
      waypoints: [
        { lat: 52.52, lon: 13.405, name: "Berlin" },
        { lat: 50.98, lon: 11.028, name: "Erfurt" },
      ],
      tracks: [[
        { lat: 52.52, lon: 13.405, ele: 34 },
        { lat: 50.98, lon: 11.028, ele: 195 },
      ]],
    });
    const parsed = await parseGpxAsync(gpx);
    const dayBreaks = parsed.waypoints
      .map((w, i) => (w.isDayBreak ? i : -1))
      .filter((i) => i >= 0);
    expect(dayBreaks).toEqual([]);
  });

  it("extracts single dayBreak index", async () => {
    const gpx = generateGpx({
      waypoints: [
        { lat: 52.52, lon: 13.405, name: "Berlin" },
        { lat: 51.84, lon: 12.243, name: "Dessau", isDayBreak: true },
        { lat: 50.98, lon: 11.028, name: "Erfurt" },
      ],
      tracks: [[
        { lat: 52.52, lon: 13.405, ele: 34 },
        { lat: 51.84, lon: 12.243, ele: 80 },
        { lat: 50.98, lon: 11.028, ele: 195 },
      ]],
    });
    const parsed = await parseGpxAsync(gpx);
    const dayBreaks = parsed.waypoints
      .map((w, i) => (w.isDayBreak ? i : -1))
      .filter((i) => i >= 0);
    expect(dayBreaks).toEqual([1]);
  });

  it("extracts multiple dayBreak indices", async () => {
    const gpx = generateGpx({
      waypoints: [
        { lat: 0, lon: 0, name: "A" },
        { lat: 1, lon: 0, name: "B", isDayBreak: true },
        { lat: 2, lon: 0, name: "C" },
        { lat: 3, lon: 0, name: "D", isDayBreak: true },
        { lat: 4, lon: 0, name: "E" },
      ],
      tracks: [[
        { lat: 0, lon: 0 }, { lat: 1, lon: 0 }, { lat: 2, lon: 0 },
        { lat: 3, lon: 0 }, { lat: 4, lon: 0 },
      ]],
    });
    const parsed = await parseGpxAsync(gpx);
    const dayBreaks = parsed.waypoints
      .map((w, i) => (w.isDayBreak ? i : -1))
      .filter((i) => i >= 0);
    expect(dayBreaks).toEqual([1, 3]);
  });
});
