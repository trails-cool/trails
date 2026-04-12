/**
 * @vitest-environment node
 *
 * These tests run WITHOUT jsdom to verify GPX parsing and generation
 * work in environments without a native DOMParser (Node.js, React Native).
 * The linkedom fallback must handle all XML parsing.
 */
import { describe, it, expect } from "vitest";
import { parseGpxAsync } from "./parse.ts";
import { generateGpx } from "./generate.ts";

const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Test Route</name><desc>A test description</desc></metadata>
  <wpt lat="52.52" lon="13.405"><name>Berlin</name></wpt>
  <wpt lat="51.84" lon="12.243"><name>Dessau</name><type>overnight</type></wpt>
  <wpt lat="48.137" lon="11.576"><name>Munich</name></wpt>
  <trk>
    <trkseg>
      <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
      <trkpt lat="51.84" lon="12.243"><ele>80</ele></trkpt>
      <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpxAsync (node environment, no DOMParser)", () => {
  it("parses route name and description", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.name).toBe("Test Route");
    expect(result.description).toBe("A test description");
  });

  it("parses waypoints", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.waypoints).toHaveLength(3);
    expect(result.waypoints[0]).toEqual({ lat: 52.52, lon: 13.405, name: "Berlin" });
  });

  it("parses isDayBreak from overnight type", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.waypoints[1]!.isDayBreak).toBe(true);
    expect(result.waypoints[0]!.isDayBreak).toBeUndefined();
  });

  it("parses tracks with elevation", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toHaveLength(3);
    expect(result.tracks[0]![0]!.ele).toBe(34);
  });

  it("computes elevation gain and distance", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.elevation.gain).toBe(485);
    expect(result.elevation.loss).toBe(0);
    expect(result.distance).toBeGreaterThan(400_000);
  });
});

describe("generateGpx + parseGpxAsync round-trip (node environment)", () => {
  it("round-trips waypoints, tracks, and metadata", async () => {
    const gpx = generateGpx({
      name: "Round Trip",
      description: "Testing",
      waypoints: [
        { lat: 52.52, lon: 13.405, name: "Start" },
        { lat: 51.0, lon: 12.0, name: "Camp", isDayBreak: true },
        { lat: 48.137, lon: 11.576, name: "End" },
      ],
      tracks: [[
        { lat: 52.52, lon: 13.405, ele: 34 },
        { lat: 51.0, lon: 12.0, ele: 200 },
        { lat: 48.137, lon: 11.576, ele: 519 },
      ]],
    });

    const parsed = await parseGpxAsync(gpx);
    expect(parsed.name).toBe("Round Trip");
    expect(parsed.description).toBe("Testing");
    expect(parsed.waypoints).toHaveLength(3);
    expect(parsed.waypoints[1]!.isDayBreak).toBe(true);
    expect(parsed.tracks[0]).toHaveLength(3);
  });
});
