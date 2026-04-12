import { describe, it, expect } from "vitest";
import { baseLayers, overlayLayers } from "./tiles.ts";

describe("baseLayers", () => {
  it("has at least one base layer", () => {
    expect(baseLayers.length).toBeGreaterThan(0);
  });

  it("every layer has a valid URL template", () => {
    for (const layer of baseLayers) {
      expect(layer.url).toContain("{z}");
      expect(layer.url).toContain("{x}");
      expect(layer.url).toContain("{y}");
    }
  });

  it("every layer has a name and attribution", () => {
    for (const layer of baseLayers) {
      expect(layer.name).toBeTruthy();
      expect(layer.attribution).toBeTruthy();
    }
  });

  it("includes OpenStreetMap", () => {
    expect(baseLayers.some((l) => l.name === "OpenStreetMap")).toBe(true);
  });
});

describe("overlayLayers", () => {
  it("every overlay has a unique id", () => {
    const ids = overlayLayers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every overlay has a valid URL template", () => {
    for (const layer of overlayLayers) {
      expect(layer.url).toContain("{z}");
    }
  });
});
