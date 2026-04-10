import { describe, it, expect } from "vitest";
import { generateGpx } from "./generate.ts";
import { parseGpxAsync } from "./parse.ts";

describe("generateGpx", () => {
  it("generates valid GPX with name", () => {
    const gpx = generateGpx({ name: "Test Route" });
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<name>Test Route</name>");
    expect(gpx).toContain("</gpx>");
  });

  it("generates waypoints", () => {
    const gpx = generateGpx({
      waypoints: [
        { lat: 52.52, lon: 13.405, name: "Berlin" },
        { lat: 48.137, lon: 11.576 },
      ],
    });
    expect(gpx).toContain('wpt lat="52.52" lon="13.405"');
    expect(gpx).toContain("<name>Berlin</name>");
    expect(gpx).toContain('wpt lat="48.137" lon="11.576"');
  });

  it("generates track points with elevation", () => {
    const gpx = generateGpx({
      tracks: [[{ lat: 52.52, lon: 13.405, ele: 34 }, { lat: 48.137, lon: 11.576, ele: 519 }]],
    });
    expect(gpx).toContain("<trkseg>");
    expect(gpx).toContain('<trkpt lat="52.52" lon="13.405">');
    expect(gpx).toContain("<ele>34</ele>");
  });

  it("escapes XML special characters in names", () => {
    const gpx = generateGpx({ name: "Route <A> & B" });
    expect(gpx).toContain("Route &lt;A&gt; &amp; B");
  });

  it("produces round-trippable GPX", async () => {
    const original = generateGpx({
      name: "Round Trip",
      waypoints: [{ lat: 52.52, lon: 13.405, name: "Start" }],
      tracks: [[{ lat: 52.52, lon: 13.405, ele: 34 }, { lat: 48.137, lon: 11.576, ele: 519 }]],
    });
    const parsed = await parseGpxAsync(original);
    expect(parsed.name).toBe("Round Trip");
    expect(parsed.waypoints).toHaveLength(1);
    expect(parsed.waypoints[0]!.name).toBe("Start");
    expect(parsed.tracks[0]).toHaveLength(2);
  });

  it("emits <type>overnight</type> for isDayBreak waypoints", () => {
    const gpx = generateGpx({
      waypoints: [
        { lat: 52.52, lon: 13.405, name: "Berlin" },
        { lat: 51.84, lon: 12.243, name: "Dessau", isDayBreak: true },
        { lat: 50.98, lon: 11.028, name: "Erfurt" },
      ],
    });
    expect(gpx).toContain("<type>overnight</type>");
    // Only Dessau should have the type element
    expect(gpx.match(/<type>overnight<\/type>/g)).toHaveLength(1);
  });

  it("round-trips isDayBreak through generate and parse", async () => {
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
    expect(parsed.waypoints).toHaveLength(3);
    expect(parsed.waypoints[0]!.isDayBreak).toBeUndefined();
    expect(parsed.waypoints[1]!.isDayBreak).toBe(true);
    expect(parsed.waypoints[2]!.isDayBreak).toBeUndefined();
  });

  it("splits tracks by day with splitByDay option", () => {
    const gpx = generateGpx({
      waypoints: [
        { lat: 0, lon: 0, name: "A" },
        { lat: 1, lon: 0, name: "B", isDayBreak: true },
        { lat: 2, lon: 0, name: "C" },
      ],
      tracks: [[
        { lat: 0, lon: 0, ele: 0 },
        { lat: 0.5, lon: 0, ele: 50 },
        { lat: 1, lon: 0, ele: 100 },
        { lat: 1.5, lon: 0, ele: 150 },
        { lat: 2, lon: 0, ele: 200 },
      ]],
      splitByDay: true,
    });
    // Should have two <trk> elements
    expect(gpx.match(/<trk>/g)).toHaveLength(2);
    expect(gpx).toContain("<name>Day 1: A - B</name>");
    expect(gpx).toContain("<name>Day 2: B - C</name>");
  });
});
