import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeRoute, computeSegmentGpx, mergeGeoJsonSegments } from "./brouter";

function makeSegment(coords: number[][], length: number, ascend: number) {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {
        "track-length": String(length),
        "filtered ascend": String(ascend),
        "total-time": "100",
      },
      geometry: { type: "LineString", coordinates: coords },
    }],
  };
}

describe("mergeGeoJsonSegments", () => {
  it("merges two segments", () => {
    const seg1 = makeSegment([[13.0, 52.0, 30], [13.1, 52.1, 40], [13.2, 52.2, 50]], 1000, 10);
    const seg2 = makeSegment([[13.2, 52.2, 50], [13.3, 52.3, 60], [13.4, 52.4, 45]], 1500, 20);

    const result = mergeGeoJsonSegments([seg1, seg2] as never[]);

    expect(result.coordinates).toHaveLength(5);
    expect(result.coordinates[0]).toEqual([13.0, 52.0, 30]);
    expect(result.coordinates[2]).toEqual([13.2, 52.2, 50]);
    expect(result.coordinates[4]).toEqual([13.4, 52.4, 45]);
  });

  it("skips duplicate point at segment boundaries", () => {
    const seg1 = makeSegment([[1, 1, 0], [2, 2, 0]], 100, 0);
    const seg2 = makeSegment([[2, 2, 0], [3, 3, 0]], 100, 0);
    const seg3 = makeSegment([[3, 3, 0], [4, 4, 0]], 100, 0);

    const result = mergeGeoJsonSegments([seg1, seg2, seg3] as never[]);
    expect(result.coordinates).toHaveLength(4);
  });

  it("accumulates stats across segments", () => {
    const seg1 = makeSegment([[1, 1, 0], [2, 2, 0]], 1000, 50);
    const seg2 = makeSegment([[2, 2, 0], [3, 3, 0]], 2000, 30);

    const result = mergeGeoJsonSegments([seg1, seg2] as never[]);
    expect(result.totalLength).toBe(3000);
    expect(result.totalAscend).toBe(80);
  });

  it("handles single segment", () => {
    const seg = makeSegment([[1, 1, 10], [2, 2, 20], [3, 3, 30]], 500, 10);
    const result = mergeGeoJsonSegments([seg] as never[]);

    expect(result.coordinates).toHaveLength(3);
    expect(result.totalLength).toBe(500);
  });

  it("handles empty segment gracefully", () => {
    const seg1 = makeSegment([[1, 1, 0], [2, 2, 0]], 100, 0);
    const empty = { type: "FeatureCollection", features: [] };

    const result = mergeGeoJsonSegments([seg1, empty] as never[]);
    expect(result.coordinates).toHaveLength(2);
  });

  it("preserves 3D coordinates (elevation)", () => {
    const seg = makeSegment([[13.4, 52.5, 34], [13.38, 52.51, 40]], 500, 6);
    const result = mergeGeoJsonSegments([seg] as never[]);

    expect(result.coordinates[0]![2]).toBe(34);
    expect(result.coordinates[1]![2]).toBe(40);
  });

  it("defaults missing elevation to 0", () => {
    const seg = makeSegment([[13.4, 52.5], [13.38, 52.51]], 500, 0);
    const result = mergeGeoJsonSegments([seg] as never[]);

    expect(result.coordinates[0]![2]).toBe(0);
    expect(result.coordinates[1]![2]).toBe(0);
  });

  // Segment boundary tests
  it("tracks segment boundaries with 1 segment", () => {
    const seg = makeSegment([[0, 0, 0], [1, 1, 10], [2, 2, 20]], 100, 20);
    const result = mergeGeoJsonSegments([seg] as never[]);

    expect(result.segmentBoundaries).toEqual([0]);
  });

  it("tracks segment boundaries with 2 segments", () => {
    const seg1 = makeSegment([[0, 0, 0], [1, 1, 10], [2, 2, 20]], 100, 20);
    const seg2 = makeSegment([[2, 2, 20], [3, 3, 30], [4, 4, 40]], 100, 20);

    const result = mergeGeoJsonSegments([seg1, seg2] as never[]);

    expect(result.segmentBoundaries).toEqual([0, 3]);
    expect(result.coordinates).toHaveLength(5);
  });

  it("tracks segment boundaries with 4 segments (5 waypoints)", () => {
    const segments = [
      makeSegment([[0, 0, 0], [1, 1, 10]], 100, 10),
      makeSegment([[1, 1, 10], [2, 2, 20]], 100, 10),
      makeSegment([[2, 2, 20], [3, 3, 30]], 100, 10),
      makeSegment([[3, 3, 30], [4, 4, 40]], 100, 10),
    ];
    const result = mergeGeoJsonSegments(segments as never[]);

    expect(result.segmentBoundaries).toEqual([0, 2, 3, 4]);
    expect(result.coordinates).toHaveLength(5);
    expect(result.totalLength).toBe(400);
  });

  it("segment boundaries allow mapping point index to waypoint segment", () => {
    const seg1 = makeSegment([[0, 0, 0], [0.5, 0.5, 5], [1, 1, 10]], 100, 10);
    const seg2 = makeSegment([[1, 1, 10], [1.5, 1.5, 15], [2, 2, 20]], 100, 10);

    const result = mergeGeoJsonSegments([seg1, seg2] as never[]);
    // boundaries: [0, 3] — segment 0 is coords 0-2, segment 1 is coords 3-4

    function findSegment(pointIndex: number): number {
      const bounds = result.segmentBoundaries;
      for (let i = bounds.length - 1; i >= 0; i--) {
        if (pointIndex >= bounds[i]!) return i;
      }
      return 0;
    }

    expect(findSegment(0)).toBe(0); // first point → segment 0
    expect(findSegment(1)).toBe(0); // mid of segment 0
    expect(findSegment(2)).toBe(0); // last point of segment 0
    expect(findSegment(3)).toBe(1); // first point of segment 1
    expect(findSegment(4)).toBe(1); // last point
  });

  it("geojson field is backwards compatible", () => {
    const seg = makeSegment([[13.0, 52.0, 30], [13.1, 52.1, 40]], 500, 10);
    const result = mergeGeoJsonSegments([seg] as never[]);

    expect(result.geojson.type).toBe("FeatureCollection");
    expect(result.geojson.features).toHaveLength(1);
    expect(result.geojson.features[0]!.geometry.type).toBe("LineString");
    expect(result.geojson.features[0]!.properties["track-length"]).toBe("500");
  });
});

describe("highway tag extraction", () => {
  function makeSegmentWithTags(coords: number[][], tags: string[]) {
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {
          "track-length": "100",
          "filtered ascend": "0",
          "total-time": "100",
          messages: [
            ["Longitude", "Latitude", "Elevation", "Distance", "CostPerKm", "ElevCost", "TurnCost", "NodeCost", "InitialCost", "WayTags"],
            ...tags.map((t, i) => [String(coords[i]?.[0] ?? 0), String(coords[i]?.[1] ?? 0), "0", "100", "0", "0", "0", "0", "0", t]),
          ],
        },
        geometry: { type: "LineString", coordinates: coords },
      }],
    };
  }

  it("extracts highway tags from WayTags", () => {
    const seg = makeSegmentWithTags(
      [[13.0, 52.0, 30], [13.1, 52.1, 40], [13.2, 52.2, 50]],
      ["highway=cycleway surface=asphalt", "highway=residential surface=cobblestone", "highway=path surface=gravel"],
    );

    const result = mergeGeoJsonSegments([seg] as never[]);
    expect(result.highways[0]).toBe("cycleway");
    expect(result.highways[1]).toBe("residential");
    expect(result.highways[2]).toBe("path");
  });

  it("extracts surface and highway tags together", () => {
    const seg = makeSegmentWithTags(
      [[13.0, 52.0, 30], [13.1, 52.1, 40]],
      ["highway=tertiary surface=asphalt", "highway=cycleway surface=gravel"],
    );

    const result = mergeGeoJsonSegments([seg] as never[]);
    expect(result.surfaces[0]).toBe("asphalt");
    expect(result.highways[0]).toBe("tertiary");
    expect(result.surfaces[1]).toBe("gravel");
    expect(result.highways[1]).toBe("cycleway");
  });

  it("defaults to unknown when highway tag is missing", () => {
    const seg = makeSegmentWithTags(
      [[13.0, 52.0, 30], [13.1, 52.1, 40]],
      ["surface=asphalt", "surface=gravel"],
    );

    const result = mergeGeoJsonSegments([seg] as never[]);
    expect(result.highways[0]).toBe("unknown");
    expect(result.highways[1]).toBe("unknown");
  });

  it("handles missing WayTags column", () => {
    const seg = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {
          "track-length": "100",
          "filtered ascend": "0",
          "total-time": "100",
          messages: [["Longitude", "Latitude"]],
        },
        geometry: { type: "LineString", coordinates: [[13.0, 52.0, 30], [13.1, 52.1, 40]] },
      }],
    };

    const result = mergeGeoJsonSegments([seg] as never[]);
    expect(result.highways[0]).toBe("unknown");
    expect(result.highways[1]).toBe("unknown");
  });
});

describe("X-BRouter-Auth header", () => {
  // Minimal valid response so computeRoute doesn't throw during merge.
  const stubGeoJson = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { "track-length": "100", "filtered ascend": "0", "total-time": "10" },
        geometry: { type: "LineString", coordinates: [[13.0, 52.0, 30], [13.1, 52.1, 40]] },
      },
    ],
  });

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(stubGeoJson, { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("attaches X-BRouter-Auth when BROUTER_AUTH_TOKEN is set (computeRoute)", async () => {
    vi.stubEnv("BROUTER_AUTH_TOKEN", "test-token-abc");

    await computeRoute({
      waypoints: [
        { lat: 52.0, lon: 13.0 },
        { lat: 52.1, lon: 13.1 },
      ],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ "X-BRouter-Auth": "test-token-abc" });
  });

  it("omits X-BRouter-Auth when BROUTER_AUTH_TOKEN is unset (dev/test convenience)", async () => {
    vi.stubEnv("BROUTER_AUTH_TOKEN", "");

    await computeRoute({
      waypoints: [
        { lat: 52.0, lon: 13.0 },
        { lat: 52.1, lon: 13.1 },
      ],
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.headers).not.toHaveProperty("X-BRouter-Auth");
  });

  it("attaches X-BRouter-Auth on computeSegmentGpx as well", async () => {
    vi.stubEnv("BROUTER_AUTH_TOKEN", "test-token-xyz");
    fetchSpy.mockResolvedValueOnce(
      new Response('<gpx><trk><trkseg><trkpt lat="52" lon="13"/></trkseg></trk></gpx>', {
        status: 200,
        headers: { "content-type": "application/gpx+xml" },
      }),
    );

    await computeSegmentGpx({
      waypoints: [
        { lat: 52.0, lon: 13.0 },
        { lat: 52.1, lon: 13.1 },
      ],
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ "X-BRouter-Auth": "test-token-xyz" });
  });
});

describe("waypoint to BRouter segments", () => {
  it("splits N waypoints into N-1 pairs", () => {
    const waypoints = [
      { lat: 52.0, lon: 13.0 },
      { lat: 52.1, lon: 13.1 },
      { lat: 52.2, lon: 13.2 },
      { lat: 52.3, lon: 13.3 },
    ];

    const pairs: Array<[typeof waypoints[0], typeof waypoints[0]]> = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      pairs.push([waypoints[i]!, waypoints[i + 1]!]);
    }

    expect(pairs).toHaveLength(3);
  });
});
