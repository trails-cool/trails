import { describe, it, expect } from "vitest";

// Test the mergeGeoJsonSegments logic extracted from brouter.ts

interface GeoJsonFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][] };
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

function mergeGeoJsonSegments(segments: GeoJsonCollection[]): GeoJsonCollection {
  const allCoords: number[][] = [];
  let totalLength = 0;
  let totalAscend = 0;
  let totalTime = 0;

  for (let i = 0; i < segments.length; i++) {
    const feature = segments[i]!.features?.[0];
    if (!feature) continue;

    const coords = feature.geometry.coordinates;
    const startIdx = i === 0 ? 0 : 1;
    for (let j = startIdx; j < coords.length; j++) {
      allCoords.push(coords[j]!);
    }

    const props = feature.properties;
    totalLength += parseInt(String(props["track-length"] ?? "0"));
    totalAscend += parseInt(String(props["filtered ascend"] ?? "0"));
    totalTime += parseInt(String(props["total-time"] ?? "0"));
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          "track-length": String(totalLength),
          "filtered ascend": String(totalAscend),
          "total-time": String(totalTime),
          creator: "trails.cool (BRouter segments)",
        },
        geometry: {
          type: "LineString",
          coordinates: allCoords,
        },
      },
    ],
  };
}

function makeSegment(coords: number[][], length: number, ascend: number): GeoJsonCollection {
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
    const seg1 = makeSegment([[13.0, 52.0], [13.1, 52.1], [13.2, 52.2]], 1000, 10);
    const seg2 = makeSegment([[13.2, 52.2], [13.3, 52.3], [13.4, 52.4]], 1500, 20);

    const result = mergeGeoJsonSegments([seg1, seg2]);
    const coords = result.features[0]!.geometry.coordinates;

    // Should have 5 points (first segment 3 + second segment 2, skipping duplicate)
    expect(coords).toHaveLength(5);
    expect(coords[0]).toEqual([13.0, 52.0]);
    expect(coords[2]).toEqual([13.2, 52.2]); // shared point
    expect(coords[4]).toEqual([13.4, 52.4]);
  });

  it("skips duplicate point at segment boundaries", () => {
    const seg1 = makeSegment([[1, 1], [2, 2]], 100, 0);
    const seg2 = makeSegment([[2, 2], [3, 3]], 100, 0);
    const seg3 = makeSegment([[3, 3], [4, 4]], 100, 0);

    const result = mergeGeoJsonSegments([seg1, seg2, seg3]);
    const coords = result.features[0]!.geometry.coordinates;

    expect(coords).toHaveLength(4);
    expect(coords).toEqual([[1, 1], [2, 2], [3, 3], [4, 4]]);
  });

  it("accumulates stats across segments", () => {
    const seg1 = makeSegment([[1, 1], [2, 2]], 1000, 50);
    const seg2 = makeSegment([[2, 2], [3, 3]], 2000, 30);

    const result = mergeGeoJsonSegments([seg1, seg2]);
    const props = result.features[0]!.properties;

    expect(props["track-length"]).toBe("3000");
    expect(props["filtered ascend"]).toBe("80");
    expect(props["total-time"]).toBe("200");
  });

  it("handles single segment", () => {
    const seg = makeSegment([[1, 1], [2, 2], [3, 3]], 500, 10);
    const result = mergeGeoJsonSegments([seg]);

    expect(result.features[0]!.geometry.coordinates).toHaveLength(3);
    expect(result.features[0]!.properties["track-length"]).toBe("500");
  });

  it("handles empty segment gracefully", () => {
    const seg1 = makeSegment([[1, 1], [2, 2]], 100, 0);
    const empty: GeoJsonCollection = { type: "FeatureCollection", features: [] };

    const result = mergeGeoJsonSegments([seg1, empty]);
    expect(result.features[0]!.geometry.coordinates).toHaveLength(2);
  });

  it("preserves elevation data in coordinates", () => {
    const seg1 = makeSegment([[13.0, 52.0, 100], [13.1, 52.1, 150]], 500, 50);
    const seg2 = makeSegment([[13.1, 52.1, 150], [13.2, 52.2, 200]], 500, 50);

    const result = mergeGeoJsonSegments([seg1, seg2]);
    const coords = result.features[0]!.geometry.coordinates;

    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual([13.0, 52.0, 100]);
    expect(coords[1]).toEqual([13.1, 52.1, 150]);
    expect(coords[2]).toEqual([13.2, 52.2, 200]);
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
    expect(pairs[0]).toEqual([waypoints[0], waypoints[1]]);
    expect(pairs[1]).toEqual([waypoints[1], waypoints[2]]);
    expect(pairs[2]).toEqual([waypoints[2], waypoints[3]]);
  });

  it("formats lon,lat correctly for BRouter", () => {
    const wp = { lat: 52.5277, lon: 13.4033 };
    const lonlat = `${wp.lon},${wp.lat}`;
    expect(lonlat).toBe("13.4033,52.5277");
  });
});
