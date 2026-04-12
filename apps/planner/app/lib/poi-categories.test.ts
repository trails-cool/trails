import { describe, it, expect } from "vitest";
import { getCategoriesForProfile, profileOverlayDefaults, poiCategories } from "@trails-cool/map-core";

describe("getCategoriesForProfile", () => {
  it("returns bike infra for cycling profiles", () => {
    expect(getCategoriesForProfile("fastbike")).toContain("bike_infra");
    expect(getCategoriesForProfile("safety")).toContain("bike_infra");
  });

  it("returns shelter and viewpoints for hiking", () => {
    const cats = getCategoriesForProfile("trekking");
    expect(cats).toContain("shelter");
    expect(cats).toContain("viewpoints");
  });

  it("returns empty for unknown profiles", () => {
    expect(getCategoriesForProfile("car")).toEqual([]);
  });
});

describe("profileOverlayDefaults", () => {
  it("maps cycling profiles to waymarked-cycling", () => {
    expect(profileOverlayDefaults.fastbike).toContain("waymarked-cycling");
    expect(profileOverlayDefaults.safety).toContain("waymarked-cycling");
  });

  it("maps hiking to waymarked-hiking", () => {
    expect(profileOverlayDefaults.trekking).toContain("waymarked-hiking");
  });
});

describe("poiCategories", () => {
  it("has 9 categories", () => {
    expect(poiCategories).toHaveLength(9);
  });

  it("all categories have required fields", () => {
    for (const cat of poiCategories) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#/);
      expect(cat.query).toContain("nwr");
    }
  });
});
