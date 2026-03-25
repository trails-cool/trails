import { describe, it, expect } from "vitest";
import { parseGpx } from "./parse.ts";

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

describe("parseGpx", () => {
  it("parses route name", () => {
    const result = parseGpx(sampleGpx);
    expect(result.name).toBe("Test Route");
  });

  it("parses waypoints with lat, lon, and name", () => {
    const result = parseGpx(sampleGpx);
    expect(result.waypoints).toHaveLength(2);
    expect(result.waypoints[0]).toEqual({ lat: 52.52, lon: 13.405, name: "Berlin" });
    expect(result.waypoints[1]).toEqual({ lat: 48.137, lon: 11.576, name: "Munich" });
  });

  it("parses track points with elevation", () => {
    const result = parseGpx(sampleGpx);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toHaveLength(3);
    expect(result.tracks[0]![0]).toEqual({ lat: 52.52, lon: 13.405, ele: 34, time: undefined });
  });

  it("computes elevation gain and loss", () => {
    const result = parseGpx(sampleGpx);
    expect(result.elevation.gain).toBeGreaterThan(0);
    expect(result.elevation.loss).toBe(0); // monotonically increasing elevation
    expect(result.elevation.gain).toBe(485); // 113-34 + 519-113
  });

  it("builds elevation profile", () => {
    const result = parseGpx(sampleGpx);
    expect(result.elevation.profile).toHaveLength(3);
    expect(result.elevation.profile[0]!.distance).toBe(0);
    expect(result.elevation.profile[0]!.elevation).toBe(34);
    expect(result.elevation.profile[2]!.distance).toBeGreaterThan(0);
  });

  it("throws on invalid XML", () => {
    expect(() => parseGpx("not xml at all <<<<")).toThrow("Invalid GPX XML");
  });
});
