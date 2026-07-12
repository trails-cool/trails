import { describe, it, expect } from "vitest";
import {
  poiCategories,
  getCategoriesForProfile,
  matchingCategoryIds,
  osmiumTagFilters,
  profileOverlayDefaults,
} from "./poi.ts";

describe("poiCategories", () => {
  it("has expected categories", () => {
    const ids = poiCategories.map((c) => c.id);
    expect(ids).toContain("drinking_water");
    expect(ids).toContain("camping");
    expect(ids).toContain("food");
    expect(ids).toContain("bike_infra");
  });

  it("every category has required fields", () => {
    for (const cat of poiCategories) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cat.selectors.length).toBeGreaterThan(0);
      for (const sel of cat.selectors) {
        expect(sel.key).toBeTruthy();
        expect(sel.value).toBeTruthy();
      }
    }
  });
});

describe("getCategoriesForProfile", () => {
  it("returns trekking-specific categories", () => {
    const ids = getCategoriesForProfile("trekking");
    expect(ids).toContain("shelter");
    expect(ids).toContain("viewpoints");
    expect(ids).not.toContain("bike_infra");
  });

  it("returns cycling-specific categories", () => {
    const ids = getCategoriesForProfile("fastbike");
    expect(ids).toContain("bike_infra");
    expect(ids).not.toContain("shelter");
  });

  it("returns empty array for unknown profile", () => {
    expect(getCategoriesForProfile("unknown")).toEqual([]);
  });

  it("returns empty array for profiles with no dedicated categories", () => {
    // Categories without profiles are available to everyone, not returned here
    expect(getCategoriesForProfile("")).toEqual([]);
  });
});

describe("matchingCategoryIds", () => {
  it("classifies an element by its tags", () => {
    expect(matchingCategoryIds({ amenity: "drinking_water" })).toEqual(["drinking_water"]);
    expect(matchingCategoryIds({ tourism: "viewpoint", name: "Aussicht" })).toEqual(["viewpoints"]);
  });

  it("returns an empty array for elements matching no category", () => {
    expect(matchingCategoryIds({ highway: "primary" })).toEqual([]);
    expect(matchingCategoryIds({})).toEqual([]);
  });

  it("returns every matching category when tags satisfy more than one", () => {
    // A drinking water point that is also tagged as toilets belongs to both.
    const ids = matchingCategoryIds({ amenity: "toilets", drinking_water: "yes" });
    expect(ids).toContain("toilets");
  });

  it("matches secondary selectors within a category", () => {
    expect(matchingCategoryIds({ amenity: "water_point" })).toEqual(["drinking_water"]);
    expect(matchingCategoryIds({ tourism: "wilderness_hut" })).toEqual(["shelter"]);
  });
});

describe("osmiumTagFilters", () => {
  it("renders one nwr expression per distinct key, grouping values", () => {
    const filters = osmiumTagFilters();
    // amenity spans several categories; all its values collapse into one expr.
    const amenity = filters.find((f) => f.startsWith("nwr/amenity="));
    expect(amenity).toBeDefined();
    expect(amenity).toContain("drinking_water");
    expect(amenity).toContain("toilets");
    expect(amenity).toContain("restaurant");
    // tourism and shop each get their own expression.
    expect(filters.some((f) => f.startsWith("nwr/tourism="))).toBe(true);
    expect(filters.some((f) => f.startsWith("nwr/shop="))).toBe(true);
  });

  it("covers every selector value across the nine categories", () => {
    const filters = osmiumTagFilters();
    for (const cat of poiCategories) {
      for (const sel of cat.selectors) {
        const expr = filters.find((f) => f.startsWith(`nwr/${sel.key}=`));
        expect(expr, `expected a filter for ${sel.key}`).toBeDefined();
        expect(expr!.split("=")[1]!.split(",")).toContain(sel.value);
      }
    }
  });

  it("does not repeat a value for the same key", () => {
    const filters = osmiumTagFilters();
    for (const f of filters) {
      const values = f.split("=")[1]!.split(",");
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe("profileOverlayDefaults", () => {
  it("maps fastbike to cycling routes", () => {
    expect(profileOverlayDefaults["fastbike"]).toContain("waymarked-cycling");
  });

  it("maps trekking to hiking routes", () => {
    expect(profileOverlayDefaults["trekking"]).toContain("waymarked-hiking");
  });
});
