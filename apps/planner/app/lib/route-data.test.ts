import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { EnrichedRoute } from "./route-merge.ts";
import {
  DEFAULT_PROFILE,
  PROFILE_KEY,
  ROAD_METADATA_KEYS,
  clearRouteData,
  extractNoGoAreas,
  getBaseLayer,
  getColorMode,
  getCoordinates,
  readGeojson,
  getOverlays,
  getPoiCategories,
  getProfile,
  parseJsonArray,
  readComputedRoute,
  readRoadMetadata,
  setBaseLayer,
  setColorMode,
  setGeojson,
  setOverlays,
  setPoiCategories,
  setProfile,
  writeComputedRoute,
} from "./route-data.ts";

function createDoc(): { doc: Y.Doc; routeData: Y.Map<unknown> } {
  const doc = new Y.Doc();
  return { doc, routeData: doc.getMap("routeData") };
}

function enrichedFixture(overrides: Partial<EnrichedRoute> = {}): EnrichedRoute {
  return {
    coordinates: [
      [13.4, 52.5, 35],
      [13.41, 52.51, 40],
      [13.42, 52.52, 38],
    ],
    segmentBoundaries: [0],
    surfaces: ["asphalt", "asphalt", "gravel"],
    highways: ["cycleway", "cycleway", "track"],
    maxspeeds: ["30", "30", ""],
    smoothnesses: ["good", "good", "bad"],
    tracktypes: ["", "", "grade2"],
    cycleways: ["lane", "lane", ""],
    bikeroutes: ["", "rcn", "rcn"],
    totalLength: 2500,
    totalAscend: 12,
    totalTime: 600,
    geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [13.4, 52.5, 35],
              [13.41, 52.51, 40],
              [13.42, 52.52, 38],
            ],
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("parseJsonArray", () => {
  it("returns [] for undefined and corrupt JSON", () => {
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray("{not json")).toEqual([]);
  });

  it("parses a JSON array", () => {
    expect(parseJsonArray<number>("[1,2,3]")).toEqual([1, 2, 3]);
  });
});

describe("computed route round-trip", () => {
  it("writes an enriched route and reads it back", () => {
    const { doc, routeData } = createDoc();
    const enriched = enrichedFixture();

    writeComputedRoute(doc, routeData, enriched);
    const computed = readComputedRoute(routeData);

    expect(computed.coordinates).toEqual(enriched.coordinates);
    expect(computed.segmentBoundaries).toEqual(enriched.segmentBoundaries);
    for (const key of ROAD_METADATA_KEYS) {
      expect(computed[key]).toEqual(enriched[key]);
    }
    // Geometry is stored compact-encoded, not as a redundant geojson copy.
    expect(routeData.get("geojson")).toBeUndefined();
    expect((routeData.get("coordinates") as string).startsWith("p1:")).toBe(true);
    // readGeojson assembles an equivalent GeoJSON from the encoded coords.
    const gj = JSON.parse(readGeojson(routeData)!);
    expect(gj.features[0].geometry.coordinates).toEqual(enriched.coordinates);
  });

  it("keeps previous metadata when a recompute yields empty arrays", () => {
    const { doc, routeData } = createDoc();
    writeComputedRoute(doc, routeData, enrichedFixture());
    writeComputedRoute(doc, routeData, enrichedFixture({ surfaces: [] }));

    // empty surfaces are not written; the previous value remains
    expect(readComputedRoute(routeData).surfaces).toEqual(["asphalt", "asphalt", "gravel"]);
  });

  it("writes in a single transaction", () => {
    const { doc, routeData } = createDoc();
    let events = 0;
    routeData.observe(() => events++);
    writeComputedRoute(doc, routeData, enrichedFixture());
    expect(events).toBe(1);
  });

  it("returns null coordinates and empty arrays for an empty document", () => {
    const { routeData } = createDoc();
    const computed = readComputedRoute(routeData);
    expect(computed.coordinates).toBeNull();
    expect(computed.segmentBoundaries).toEqual([]);
    expect(computed.surfaces).toEqual([]);
  });
});

describe("getCoordinates", () => {
  it("falls back to geojson for documents without a coordinates key", () => {
    const { routeData } = createDoc();
    setGeojson(routeData, enrichedFixture().geojson);

    expect(getCoordinates(routeData)).toEqual([
      [13.4, 52.5, 35],
      [13.41, 52.51, 40],
      [13.42, 52.52, 38],
    ]);
  });

  it("defaults missing elevation to 0 in the geojson fallback", () => {
    const { routeData } = createDoc();
    setGeojson(routeData, {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [[13.4, 52.5], [13.41, 52.51]] },
        },
      ],
    });

    expect(getCoordinates(routeData)).toEqual([
      [13.4, 52.5, 0],
      [13.41, 52.51, 0],
    ]);
  });

  it("returns null when neither key is set", () => {
    const { routeData } = createDoc();
    expect(getCoordinates(routeData)).toBeNull();
  });
});

describe("backward compatibility (legacy JSON format)", () => {
  it("reads a route persisted in the legacy JSON encoding", () => {
    const { routeData } = createDoc();
    const enriched = enrichedFixture();
    // Simulate a document written before this change: raw JSON keys.
    routeData.set("geojson", JSON.stringify(enriched.geojson));
    routeData.set("coordinates", JSON.stringify(enriched.coordinates));
    routeData.set("segmentBoundaries", JSON.stringify(enriched.segmentBoundaries));
    for (const key of ROAD_METADATA_KEYS) routeData.set(key, JSON.stringify(enriched[key]));

    const computed = readComputedRoute(routeData);
    expect(computed.coordinates).toEqual(enriched.coordinates);
    for (const key of ROAD_METADATA_KEYS) expect(computed[key]).toEqual(enriched[key]);
    // readGeojson returns the stored legacy geojson verbatim.
    expect(readGeojson(routeData)).toBe(JSON.stringify(enriched.geojson));
  });
});

describe("encoding size", () => {
  it("stores a long route far smaller than the legacy JSON encoding", () => {
    const { doc, routeData } = createDoc();
    const coordinates: [number, number, number][] = [];
    const surfaces: string[] = [];
    for (let i = 0; i < 4000; i++) {
      coordinates.push([Number((13.4 + i * 0.0002).toFixed(5)), Number((52.5 + i * 0.00005).toFixed(5)), 100 + (i % 50)]);
      surfaces.push(i < 3000 ? "asphalt" : "gravel");
    }
    const enriched = enrichedFixture({ coordinates, surfaces, geojson: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }] } });

    writeComputedRoute(doc, routeData, enriched);
    const encodedBytes = Y.encodeStateAsUpdate(doc).byteLength;

    // The legacy encoding stored geojson + coordinates (both full) + JSON metadata.
    const legacyBytes = JSON.stringify(enriched.geojson).length + JSON.stringify(coordinates).length + JSON.stringify(surfaces).length;
    expect(encodedBytes).toBeLessThan(legacyBytes / 4); // >4x smaller
    // And it round-trips.
    expect(getCoordinates(routeData)).toHaveLength(4000);
    expect(readRoadMetadata(routeData).surfaces).toHaveLength(4000);
  });
});

describe("profile and view preferences", () => {
  it("round-trips the profile", () => {
    const { routeData } = createDoc();
    expect(getProfile(routeData)).toBeUndefined();
    setProfile(routeData, DEFAULT_PROFILE);
    expect(getProfile(routeData)).toBe(DEFAULT_PROFILE);
    expect(routeData.has(PROFILE_KEY)).toBe(true);
  });

  it("defaults colorMode to plain and round-trips it", () => {
    const { routeData } = createDoc();
    expect(getColorMode(routeData)).toBe("plain");
    setColorMode(routeData, "surface");
    expect(getColorMode(routeData)).toBe("surface");
  });

  it("round-trips baseLayer and overlays", () => {
    const { routeData } = createDoc();
    expect(getBaseLayer(routeData)).toBeUndefined();
    expect(getOverlays(routeData)).toBeUndefined();
    setBaseLayer(routeData, "OpenTopoMap");
    setOverlays(routeData, ["hiking", "cycling"]);
    expect(getBaseLayer(routeData)).toBe("OpenTopoMap");
    expect(getOverlays(routeData)).toEqual(["hiking", "cycling"]);
  });

  it("treats corrupt overlays/poiCategories as unset", () => {
    const { routeData } = createDoc();
    routeData.set("overlays", "{corrupt");
    routeData.set("poiCategories", "{corrupt");
    expect(getOverlays(routeData)).toBeUndefined();
    expect(getPoiCategories(routeData)).toBeUndefined();
  });

  it("round-trips poiCategories", () => {
    const { routeData } = createDoc();
    setPoiCategories(routeData, ["water", "camping"]);
    expect(getPoiCategories(routeData)).toEqual(["water", "camping"]);
  });
});

describe("clearRouteData", () => {
  it("removes the computed route and profile but keeps view preferences", () => {
    const { doc, routeData } = createDoc();
    writeComputedRoute(doc, routeData, enrichedFixture());
    setProfile(routeData, "trekking");
    setColorMode(routeData, "surface");
    setOverlays(routeData, ["hiking"]);

    clearRouteData(doc, routeData);

    expect(getCoordinates(routeData)).toBeNull();
    expect(readGeojson(routeData)).toBeUndefined();
    expect(getProfile(routeData)).toBeUndefined();
    expect(readRoadMetadata(routeData).surfaces).toEqual([]);
    expect(getColorMode(routeData)).toBe("surface");
    expect(getOverlays(routeData)).toEqual(["hiking"]);
  });
});

describe("extractNoGoAreas", () => {
  it("reads areas and drops degenerate ones", () => {
    const doc = new Y.Doc();
    const noGoAreas = doc.getArray<Y.Map<unknown>>("noGoAreas");

    const valid = new Y.Map<unknown>();
    valid.set("points", [
      { lat: 52.5, lon: 13.4 },
      { lat: 52.51, lon: 13.41 },
      { lat: 52.52, lon: 13.4 },
    ]);
    const degenerate = new Y.Map<unknown>();
    degenerate.set("points", [{ lat: 52.5, lon: 13.4 }]);
    const empty = new Y.Map<unknown>();
    noGoAreas.push([valid, degenerate, empty]);

    const areas = extractNoGoAreas(noGoAreas);
    expect(areas).toHaveLength(1);
    expect(areas[0]!.points).toHaveLength(3);
  });
});
