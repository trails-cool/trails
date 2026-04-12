/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { baseLayers, overlayLayers } from "./index.ts";

describe("map package exports", () => {
  it("re-exports baseLayers from map-core", () => {
    expect(baseLayers).toBeDefined();
    expect(baseLayers.length).toBeGreaterThan(0);
    expect(baseLayers[0]!.name).toBe("OpenStreetMap");
  });

  it("re-exports overlayLayers from map-core", () => {
    expect(overlayLayers).toBeDefined();
    expect(overlayLayers.length).toBeGreaterThan(0);
    expect(overlayLayers.every((l) => l.id)).toBe(true);
  });
});
