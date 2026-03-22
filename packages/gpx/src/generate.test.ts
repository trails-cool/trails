import { describe, it, expect } from "vitest";
import { generateGpx } from "./generate";
import { parseGpx } from "./parse";

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

  it("produces round-trippable GPX", () => {
    const original = generateGpx({
      name: "Round Trip",
      waypoints: [{ lat: 52.52, lon: 13.405, name: "Start" }],
      tracks: [[{ lat: 52.52, lon: 13.405, ele: 34 }, { lat: 48.137, lon: 11.576, ele: 519 }]],
    });
    const parsed = parseGpx(original);
    expect(parsed.name).toBe("Round Trip");
    expect(parsed.waypoints).toHaveLength(1);
    expect(parsed.waypoints[0]!.name).toBe("Start");
    expect(parsed.tracks[0]).toHaveLength(2);
  });
});
