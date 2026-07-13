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

describe("parseGpxAsync — invalid point handling", () => {
  const gpx = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

  it("skips a point with a missing lat/lon instead of defaulting to Null Island", async () => {
    const result = await parseGpxAsync(
      gpx(`<trk><trkseg>
        <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
        <trkpt lon="13.74"><ele>113</ele></trkpt>
        <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
      </trkseg></trk>`),
    );
    expect(result.tracks[0]).toHaveLength(2);
    // No 0,0 point leaked in.
    expect(result.tracks[0]!.some((p) => p.lat === 0 && p.lon === 0)).toBe(false);
  });

  it("skips a point with garbage coords and keeps distance finite", async () => {
    const result = await parseGpxAsync(
      gpx(`<trk><trkseg>
        <trkpt lat="52.52" lon="13.405"></trkpt>
        <trkpt lat="abc" lon="13.74"></trkpt>
        <trkpt lat="48.137" lon="11.576"></trkpt>
      </trkseg></trk>`),
    );
    expect(result.tracks[0]).toHaveLength(2);
    expect(Number.isFinite(result.distance)).toBe(true);
    expect(result.distance).toBeGreaterThan(0);
  });

  it("treats unparseable <ele> as undefined so gain/loss stay finite", async () => {
    const result = await parseGpxAsync(
      gpx(`<trk><trkseg>
        <trkpt lat="52.52" lon="13.405"><ele>34</ele></trkpt>
        <trkpt lat="51.05" lon="13.74"><ele>NaN</ele></trkpt>
        <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
      </trkseg></trk>`),
    );
    expect(result.tracks[0]![1]!.ele).toBeUndefined();
    expect(Number.isFinite(result.elevation.gain)).toBe(true);
    expect(Number.isFinite(result.elevation.loss)).toBe(true);
  });

  it("tolerates trailing junk on a numeric value (parseFloat lenience)", async () => {
    const result = await parseGpxAsync(
      gpx(`<trk><trkseg>
        <trkpt lat="52.52" lon="13.405"><ele>471.0m</ele></trkpt>
        <trkpt lat="48.137" lon="11.576"><ele>519</ele></trkpt>
      </trkseg></trk>`),
    );
    expect(result.tracks[0]![0]!.ele).toBe(471);
  });

  it("drops a segment left with fewer than 2 points", async () => {
    const result = await parseGpxAsync(
      gpx(`<trk>
        <trkseg><trkpt lat="52.52" lon="13.405"></trkpt></trkseg>
        <trkseg>
          <trkpt lat="52.52" lon="13.405"></trkpt>
          <trkpt lat="48.137" lon="11.576"></trkpt>
        </trkseg>
      </trk>`),
    );
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toHaveLength(2);
  });

  it("leaves a well-formed file's output unchanged", async () => {
    const result = await parseGpxAsync(sampleGpx);
    expect(result.tracks).toEqual([
      [
        { lat: 52.52, lon: 13.405, ele: 34, time: undefined },
        { lat: 51.05, lon: 13.74, ele: 113, time: undefined },
        { lat: 48.137, lon: 11.576, ele: 519, time: undefined },
      ],
    ]);
  });
});

describe("parseGpxAsync — route (<rte>) support", () => {
  const gpx = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

  it("parses a route-only file into one segment", async () => {
    const result = await parseGpxAsync(
      gpx(`<rte><name>My Course</name>
        <rtept lat="52.52" lon="13.405"><ele>34</ele></rtept>
        <rtept lat="51.05" lon="13.74"><ele>113</ele></rtept>
        <rtept lat="48.137" lon="11.576"><ele>519</ele></rtept>
      </rte>`),
    );
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toHaveLength(3);
    expect(result.distance).toBeGreaterThan(0);
  });

  it("preserves rtept ele and time", async () => {
    const result = await parseGpxAsync(
      gpx(`<rte>
        <rtept lat="52.52" lon="13.405"><ele>34</ele><time>2026-01-01T10:00:00Z</time></rtept>
        <rtept lat="48.137" lon="11.576"><ele>519</ele><time>2026-01-01T11:00:00Z</time></rtept>
      </rte>`),
    );
    expect(result.tracks[0]![0]).toEqual({
      lat: 52.52,
      lon: 13.405,
      ele: 34,
      time: "2026-01-01T10:00:00Z",
    });
  });

  it("appends route segments after track segments", async () => {
    const result = await parseGpxAsync(
      gpx(`<trk><trkseg>
          <trkpt lat="52.52" lon="13.405"></trkpt>
          <trkpt lat="51.05" lon="13.74"></trkpt>
        </trkseg></trk>
        <rte>
          <rtept lat="10.0" lon="10.0"></rtept>
          <rtept lat="11.0" lon="11.0"></rtept>
        </rte>`),
    );
    expect(result.tracks).toHaveLength(2);
    // Track first, route second.
    expect(result.tracks[0]![0]!.lat).toBe(52.52);
    expect(result.tracks[1]![0]!.lat).toBe(10.0);
  });
});
