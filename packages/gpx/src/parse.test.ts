/**
 * @vitest-environment jsdom
 *
 * Tests the browser DOMParser path. The linkedom/node path is covered
 * by parse-node.test.ts.
 */
import { describe, it, expect } from "vitest";
import { parseGpxAsync } from "./parse.ts";

const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Test Route</name></metadata>
  <wpt lat="52.52" lon="13.405"><name>Berlin</name></wpt>
  <wpt lat="48.137" lon="11.576"><name>Munich</name></wpt>
  <trk>
    <trkseg>
      <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
      <trkpt lat="51.05" lon="13.74"><ele>113</ele></trkpt>
      <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpxAsync", () => {
  it("parses route name", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.name).toBe("Test Route");
  });

  it("parses waypoints with lat, lon, and name", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.waypoints).toHaveLength(2);
    expect(result.waypoints[0]).toEqual({ lat: 52.52, lon: 13.405, name: "Berlin" });
    expect(result.waypoints[1]).toEqual({ lat: 48.137, lon: 11.576, name: "Munich" });
  });

  it("parses track points with elevation", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toHaveLength(3);
    expect(result.tracks[0]![0]).toEqual({ lat: 52.52, lon: 13.405, ele: 34, time: undefined });
  });

  it("computes elevation gain and loss", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.elevation.gain).toBeGreaterThan(0);
    expect(result.elevation.loss).toBe(0); // monotonically increasing elevation
    expect(result.elevation.gain).toBe(485); // 113-34 + 519-113
  });

  it("builds elevation profile", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.elevation.profile).toHaveLength(3);
    expect(result.elevation.profile[0]!.distance).toBe(0);
    expect(result.elevation.profile[0]!.elevation).toBe(34);
    expect(result.elevation.profile[2]!.distance).toBeGreaterThan(0);
  });

  it("computes total distance independently of elevation", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.distance).toBeGreaterThan(0);
    // Berlin to Munich is ~500km, our 3-point track should be in that range
    expect(result.distance).toBeGreaterThan(400_000);
    expect(result.distance).toBeLessThan(600_000);
  });

  it("throws on invalid XML", async () => {
    await expect(parseGpxAsync("not xml at all <<<<")).rejects.toThrow();
  });
});
