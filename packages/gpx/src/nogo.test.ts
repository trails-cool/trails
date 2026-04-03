import { describe, it, expect } from "vitest";
import { generateGpx } from "./generate.ts";
import { parseGpxAsync } from "./parse.ts";
import { extractWaypoints } from "./waypoints.ts";

describe("no-go area generation", () => {
  it("includes trails namespace when no-go areas are present", () => {
    const gpx = generateGpx({
      noGoAreas: [{ points: [{ lat: 52, lon: 13 }, { lat: 51, lon: 13 }, { lat: 51, lon: 14 }] }],
    });
    expect(gpx).toContain('xmlns:trails="https://trails.cool/gpx/1"');
  });

  it("does not include trails namespace without no-go areas", () => {
    const gpx = generateGpx({ name: "test" });
    expect(gpx).not.toContain("xmlns:trails");
    expect(gpx).not.toContain("<extensions>");
  });

  it("generates correct extension structure", () => {
    const gpx = generateGpx({
      noGoAreas: [{ points: [{ lat: 52.5, lon: 13.3 }, { lat: 52.4, lon: 13.4 }, { lat: 52.3, lon: 13.2 }] }],
    });
    expect(gpx).toContain("<extensions>");
    expect(gpx).toContain("<trails:planning>");
    expect(gpx).toContain("<trails:nogo>");
    expect(gpx).toContain('<trails:point lat="52.5" lon="13.3"/>');
    expect(gpx).toContain('<trails:point lat="52.4" lon="13.4"/>');
    expect(gpx).toContain('<trails:point lat="52.3" lon="13.2"/>');
  });

  it("generates multiple no-go areas", () => {
    const gpx = generateGpx({
      noGoAreas: [
        { points: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }] },
        { points: [{ lat: 7, lon: 8 }, { lat: 9, lon: 10 }, { lat: 11, lon: 12 }] },
      ],
    });
    const matches = gpx.match(/<trails:nogo>/g);
    expect(matches).toHaveLength(2);
  });
});

describe("no-go area parsing", () => {
  it("parses namespaced no-go areas", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="trails.cool"
      xmlns="http://www.topografix.com/GPX/1/1"
      xmlns:trails="https://trails.cool/gpx/1">
      <extensions>
        <trails:planning>
          <trails:nogo>
            <trails:point lat="52.5" lon="13.3"/>
            <trails:point lat="52.4" lon="13.4"/>
            <trails:point lat="52.3" lon="13.2"/>
          </trails:nogo>
        </trails:planning>
      </extensions>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    expect(data.noGoAreas).toHaveLength(1);
    expect(data.noGoAreas[0]!.points).toHaveLength(3);
    expect(data.noGoAreas[0]!.points[0]).toEqual({ lat: 52.5, lon: 13.3 });
  });

  it("parses non-namespaced no-go areas", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <extensions>
        <planning>
          <nogo>
            <point lat="52.5" lon="13.3"/>
            <point lat="52.4" lon="13.4"/>
            <point lat="52.3" lon="13.2"/>
          </nogo>
        </planning>
      </extensions>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    expect(data.noGoAreas).toHaveLength(1);
    expect(data.noGoAreas[0]!.points).toHaveLength(3);
  });

  it("rejects no-go areas with fewer than 3 points", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <extensions><planning>
        <nogo><point lat="1" lon="2"/><point lat="3" lon="4"/></nogo>
      </planning></extensions>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    expect(data.noGoAreas).toHaveLength(0);
  });

  it("returns empty array when no extensions", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg><trkpt lat="52" lon="13"/></trkseg></trk>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    expect(data.noGoAreas).toHaveLength(0);
  });

  it("parses multiple no-go areas", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <extensions><planning>
        <nogo>
          <point lat="1" lon="2"/><point lat="3" lon="4"/><point lat="5" lon="6"/>
        </nogo>
        <nogo>
          <point lat="7" lon="8"/><point lat="9" lon="10"/><point lat="11" lon="12"/>
        </nogo>
      </planning></extensions>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    expect(data.noGoAreas).toHaveLength(2);
  });
});

describe("no-go area round-trip", () => {
  it("round-trips no-go areas through generate and parse", async () => {
    const noGoAreas = [
      { points: [{ lat: 52.5, lon: 13.3 }, { lat: 52.4, lon: 13.4 }, { lat: 52.3, lon: 13.2 }] },
      { points: [{ lat: 48.1, lon: 11.5 }, { lat: 48.0, lon: 11.6 }, { lat: 47.9, lon: 11.4 }] },
    ];
    const gpx = generateGpx({
      name: "No-go test",
      tracks: [[{ lat: 52.5, lon: 13.3, ele: 34 }, { lat: 48.1, lon: 11.5, ele: 519 }]],
      noGoAreas,
    });
    const parsed = await parseGpxAsync(gpx);
    expect(parsed.name).toBe("No-go test");
    expect(parsed.noGoAreas).toHaveLength(2);
    expect(parsed.noGoAreas[0]!.points).toEqual(noGoAreas[0]!.points);
    expect(parsed.noGoAreas[1]!.points).toEqual(noGoAreas[1]!.points);
  });

  it("round-trips complete planning state", async () => {
    const gpx = generateGpx({
      name: "Full plan",
      waypoints: [{ lat: 52.5, lon: 13.3, name: "Berlin" }, { lat: 48.1, lon: 11.5, name: "Munich" }],
      tracks: [[{ lat: 52.5, lon: 13.3, ele: 34 }, { lat: 50.0, lon: 12.0, ele: 300 }, { lat: 48.1, lon: 11.5, ele: 519 }]],
      noGoAreas: [{ points: [{ lat: 51, lon: 12 }, { lat: 50, lon: 13 }, { lat: 50, lon: 11 }] }],
    });
    const parsed = await parseGpxAsync(gpx);
    expect(parsed.name).toBe("Full plan");
    expect(parsed.waypoints).toHaveLength(2);
    expect(parsed.tracks[0]).toHaveLength(3);
    expect(parsed.noGoAreas).toHaveLength(1);
    expect(parsed.distance).toBeGreaterThan(0);
  });
});

describe("extractWaypoints", () => {
  it("returns explicit waypoints when present", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <wpt lat="52.52" lon="13.405"><name>Berlin</name></wpt>
      <wpt lat="48.137" lon="11.576"><name>Munich</name></wpt>
      <trk><trkseg>
        <trkpt lat="52.52" lon="13.405"/>
        <trkpt lat="48.137" lon="11.576"/>
      </trkseg></trk>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    const wps = extractWaypoints(data);
    expect(wps).toHaveLength(2);
    expect(wps[0]!.name).toBe("Berlin");
  });

  it("extracts segment endpoints for multi-segment tracks", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk>
        <trkseg><trkpt lat="52" lon="13"/><trkpt lat="51" lon="13"/></trkseg>
        <trkseg><trkpt lat="51" lon="13"/><trkpt lat="50" lon="12"/></trkseg>
        <trkseg><trkpt lat="50" lon="12"/><trkpt lat="48" lon="11"/></trkseg>
      </trk>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    const wps = extractWaypoints(data);
    // Start of each segment (deduped) + end of last = 52, 51, 50, 48
    expect(wps.length).toBeGreaterThanOrEqual(3);
    expect(wps[0]).toEqual({ lat: 52, lon: 13 });
  });

  it("uses Douglas-Peucker for single-segment tracks", async () => {
    // Build a track with a clear deviation in the middle
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const lat = 52 - i * 0.4; // straight south
      const lon = i === 5 ? 14.5 : 13; // big eastward deviation at midpoint
      points.push(`<trkpt lat="${lat}" lon="${lon}"/>`);
    }
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>${points.join("")}</trkseg></trk>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    const wps = extractWaypoints(data);
    // Should include start, end, and the midpoint deviation
    expect(wps.length).toBeGreaterThanOrEqual(3);
    // The deviated midpoint should be preserved
    const hasDeviation = wps.some((w) => Math.abs(w.lon - 14.5) < 0.01);
    expect(hasDeviation).toBe(true);
  });

  it("returns empty for empty tracks", async () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg></trkseg></trk>
    </gpx>`;
    const data = await parseGpxAsync(gpx);
    const wps = extractWaypoints(data);
    expect(wps).toHaveLength(0);
  });
});
