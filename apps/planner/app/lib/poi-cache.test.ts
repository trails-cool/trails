import { describe, it, expect, beforeEach } from "vitest";
import { quantize, getCellKeys, getCached, setCached, clearCache } from "./poi-cache.ts";
import type { Poi } from "./overpass.ts";

beforeEach(() => {
  clearCache();
});

describe("quantize", () => {
  it("rounds down to 0.1 degree grid", () => {
    expect(quantize(52.537)).toBe(52.5);
    expect(quantize(13.405)).toBe(13.4);
    expect(quantize(0.0)).toBe(0);
    expect(quantize(-0.15)).toBe(-0.2);
  });
});

describe("getCellKeys", () => {
  it("returns cell keys covering the bbox", () => {
    const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.4 };
    const keys = getCellKeys(bbox);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain("52.5,13.3");
    expect(keys).toContain("52.5,13.4");
    expect(keys).toContain("52.6,13.3");
  });
});

describe("getCached / setCached", () => {
  const bbox = { south: 52.5, west: 13.3, north: 52.6, east: 13.4 };
  const categoriesKey = "drinking_water";
  const pois: Poi[] = [
    { id: 1, lat: 52.52, lon: 13.35, category: "drinking_water", tags: {} },
    { id: 2, lat: 52.55, lon: 13.38, category: "drinking_water", tags: {} },
  ];

  it("returns null on cache miss", () => {
    expect(getCached(bbox, categoriesKey)).toBeNull();
  });

  it("returns cached POIs on cache hit", () => {
    setCached(bbox, categoriesKey, pois);
    const result = getCached(bbox, categoriesKey);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it("filters POIs to requested bbox", () => {
    setCached(bbox, categoriesKey, [
      ...pois,
      { id: 3, lat: 52.9, lon: 13.35, category: "drinking_water", tags: {} }, // outside bbox
    ]);
    const result = getCached(bbox, categoriesKey);
    expect(result).toHaveLength(2); // only the 2 within bbox
  });

  it("returns null for different categories key", () => {
    setCached(bbox, categoriesKey, pois);
    expect(getCached(bbox, "camping")).toBeNull();
  });
});
