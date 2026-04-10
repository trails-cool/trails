import { describe, it, expect } from "vitest";
import { buildQuery, parseResponse, deduplicateById, type Poi } from "./overpass.ts";
import { poiCategories } from "./poi-categories.ts";

describe("buildQuery", () => {
  it("builds Overpass QL with bbox and category union", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.5 };
    const categories = poiCategories.filter((c) => c.id === "drinking_water");
    const query = buildQuery(bbox, categories);

    expect(query).toContain("[out:json]");
    expect(query).toContain("[bbox:52.5,13.3,52.6,13.5]");
    expect(query).toContain('amenity"="drinking_water"');
    expect(query).toContain("out center 200");
  });

  it("combines multiple categories into a single union", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.5 };
    const categories = poiCategories.filter((c) => ["drinking_water", "camping"].includes(c.id));
    const query = buildQuery(bbox, categories);

    expect(query).toContain("drinking_water");
    expect(query).toContain("camp_site");
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
