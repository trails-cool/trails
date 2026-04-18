import { describe, it, expect } from "vitest";
import { buildQuery, parseResponse, deduplicateById, quantizeBbox, type Poi } from "./overpass.ts";
import { poiCategories } from "@trails-cool/map-core";

describe("buildQuery", () => {
  it("builds Overpass QL with bbox and category union", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.5 };
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const query = buildQuery(bbox, categories);

    expect(query).toContain("[out:json]");
    expect(query).toContain("[bbox:52.500,13.300,52.600,13.500]");
    expect(query).toContain('amenity"="drinking_water"');
    expect(query).toContain("out center qt 100");
  });

  it("combines multiple categories into a single union", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.5 };
    const categories = poiCategories.filter((c) => ["drinking_water", "camping"].includes(c.id));
    const query = buildQuery(bbox, categories);

    expect(query).toContain("drinking_water");
    expect(query).toContain("camp_site");
  });

  it("produces identical queries for near-identical viewports within one grid cell", () => {
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const a = buildQuery(
      { south: 52.5041, west: 13.3072, north: 52.5931, east: 13.4928 },
      categories,
    );
    const b = buildQuery(
      { south: 52.5039, west: 13.3078, north: 52.5925, east: 13.4921 },
      categories,
    );
    expect(a).toBe(b);
  });

  it("expands the bbox outward so the original viewport is always covered", () => {
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const query = buildQuery(
      { south: 52.5041, west: 13.3072, north: 52.5931, east: 13.4928 },
      categories,
    );
    expect(query).toContain("[bbox:52.500,13.300,52.600,13.500]");
  });
});

describe("quantizeBbox", () => {
  it("snaps south and west down, north and east up", () => {
    const q = quantizeBbox({ south: 52.5041, west: 13.3072, north: 52.5931, east: 13.4928 }, 0.01);
    expect(q.south).toBeCloseTo(52.5, 10);
    expect(q.west).toBeCloseTo(13.3, 10);
    expect(q.north).toBeCloseTo(52.6, 10);
    expect(q.east).toBeCloseTo(13.5, 10);
  });

  it("is idempotent on already-aligned coordinates", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.5 };
    const q = quantizeBbox(bbox, 0.01);
    expect(q.south).toBeCloseTo(52.5, 10);
    expect(q.north).toBeCloseTo(52.6, 10);
  });
});

describe("parseResponse", () => {
  it("parses nodes into Poi objects", () => {
    const data = {
      elements: [
        {
          type: "node",
          id: 123,
          lat: 52.52,
          lon: 13.405,
          tags: { amenity: "drinking_water", name: "Brunnen" },
        },
      ],
    };
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const pois = parseResponse(data, categories);

    expect(pois).toHaveLength(1);
    expect(pois[0]!.id).toBe(123);
    expect(pois[0]!.name).toBe("Brunnen");
    expect(pois[0]!.category).toBe("drinking_water");
    expect(pois[0]!.lat).toBe(52.52);
  });

  it("uses center for way/relation elements", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 456,
          center: { lat: 52.51, lon: 13.39 },
          tags: { tourism: "camp_site", name: "Zeltplatz" },
        },
      ],
    };
    const categories = poiCategories.filter((c) => c.id === "camping");
    const pois = parseResponse(data, categories);

    expect(pois).toHaveLength(1);
    expect(pois[0]!.lat).toBe(52.51);
    expect(pois[0]!.lon).toBe(13.39);
  });

  it("skips elements without coordinates", () => {
    const data = {
      elements: [
        { type: "node", id: 789, tags: { amenity: "drinking_water" } },
      ],
    };
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const pois = parseResponse(data, categories);
    expect(pois).toHaveLength(0);
  });

  it("skips elements that don't match any category", () => {
    const data = {
      elements: [
        { type: "node", id: 100, lat: 52.52, lon: 13.4, tags: { amenity: "bank" } },
      ],
    };
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const pois = parseResponse(data, categories);
    expect(pois).toHaveLength(0);
  });
});

describe("deduplicateById", () => {
  it("removes duplicate POIs by id", () => {
    const pois: Poi[] = [
      { id: 1, lat: 52.5, lon: 13.4, category: "drinking_water", tags: {} },
      { id: 1, lat: 52.5, lon: 13.4, category: "camping", tags: {} },
      { id: 2, lat: 52.6, lon: 13.5, category: "shelter", tags: {} },
    ];
    const result = deduplicateById(pois);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe(1);
    expect(result[1]!.id).toBe(2);
  });
});
