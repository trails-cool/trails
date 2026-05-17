import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { poiCategories } from "@trails-cool/map-core";
import type { Poi } from "./overpass.ts";

// Mirrors the snapToPoi logic from WaypointSidebar / PlannerMap
function snapToPoi(
  doc: Y.Doc,
  waypoints: Y.Array<Y.Map<unknown>>,
  index: number,
  poi: Poi,
) {
  const yMap = waypoints.get(index);
  if (!yMap) return;
  const cat = poiCategories.find((c) => c.id === poi.category);
  const notePrefix = cat ? `${cat.icon} ${poi.name ?? cat.id}` : (poi.name ?? "");
  doc.transact(() => {
    yMap.set("lat", poi.lat);
    yMap.set("lon", poi.lon);
    if (poi.name && !yMap.get("name")) yMap.set("name", poi.name);
    const existing = yMap.get("note") as string | undefined;
    yMap.set("note", existing ? `${notePrefix}\n${existing}` : notePrefix);
    if (poi.id) yMap.set("osmId", poi.id);
  }, "local");
}

function makeWaypoint(doc: Y.Doc, lat: number, lon: number, extra?: Record<string, unknown>): Y.Map<unknown> {
  const yMap = new Y.Map<unknown>();
  yMap.set("lat", lat);
  yMap.set("lon", lon);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) yMap.set(k, v);
  }
  return yMap;
}

describe("snapToPoi", () => {
  it("updates coords to POI position", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0)]);

    const poi: Poi = { id: 42, lat: 50.1, lon: 10.1, category: "drinking_water", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    expect(waypoints.get(0)!.get("lat")).toBe(50.1);
    expect(waypoints.get(0)!.get("lon")).toBe(10.1);
  });

  it("sets osmId from POI", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0)]);

    const poi: Poi = { id: 99, lat: 50.1, lon: 10.1, category: "shelter", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    expect(waypoints.get(0)!.get("osmId")).toBe(99);
  });

  it("sets name from POI when waypoint has no name", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0)]);

    const poi: Poi = { id: 1, lat: 50.1, lon: 10.1, category: "drinking_water", name: "Stadtbrunnen", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    expect(waypoints.get(0)!.get("name")).toBe("Stadtbrunnen");
  });

  it("does not overwrite an existing name", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0, { name: "My Stop" })]);

    const poi: Poi = { id: 1, lat: 50.1, lon: 10.1, category: "drinking_water", name: "Brunnen", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    expect(waypoints.get(0)!.get("name")).toBe("My Stop");
  });

  it("prepends icon+name prefix to note", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0)]);

    const poi: Poi = { id: 1, lat: 50.1, lon: 10.1, category: "drinking_water", name: "Brunnen", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    const note = waypoints.get(0)!.get("note") as string;
    expect(note).toContain("Brunnen");
    const cat = poiCategories.find((c) => c.id === "drinking_water")!;
    expect(note).toContain(cat.icon);
  });

  it("preserves existing note content after prefix", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0, { note: "Refill here" })]);

    const poi: Poi = { id: 1, lat: 50.1, lon: 10.1, category: "drinking_water", name: "Brunnen", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    const note = waypoints.get(0)!.get("note") as string;
    expect(note).toContain("Refill here");
    expect(note.indexOf("Brunnen")).toBeLessThan(note.indexOf("Refill here"));
  });

  it("performs all changes in a single Yjs transaction", () => {
    const doc = new Y.Doc();
    const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
    waypoints.insert(0, [makeWaypoint(doc, 50.0, 10.0)]);

    let txCount = 0;
    doc.on("afterTransaction", () => { txCount++; });

    const poi: Poi = { id: 1, lat: 50.1, lon: 10.1, category: "drinking_water", name: "Brunnen", tags: {} };
    snapToPoi(doc, waypoints, 0, poi);

    expect(txCount).toBe(1);
  });
});
