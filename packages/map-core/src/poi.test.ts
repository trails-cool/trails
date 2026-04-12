import { describe, it, expect } from "vitest";
import { poiCategories, getCategoriesForProfile, profileOverlayDefaults } from "./poi.ts";

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
      expect(cat.query).toBeTruthy();
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

describe("profileOverlayDefaults", () => {
  it("maps fastbike to cycling routes", () => {
    expect(profileOverlayDefaults["fastbike"]).toContain("waymarked-cycling");
  });

  it("maps trekking to hiking routes", () => {
    expect(profileOverlayDefaults["trekking"]).toContain("waymarked-hiking");
  });
});
