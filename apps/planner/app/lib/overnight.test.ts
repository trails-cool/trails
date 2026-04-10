import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { setOvernight, isOvernight } from "./overnight.ts";
import type { YjsState } from "./use-yjs.ts";

function createTestYjs(): YjsState {
  const doc = new Y.Doc();
  const waypoints = doc.getArray<Y.Map<unknown>>("waypoints");
  return { doc, waypoints } as unknown as YjsState;
}

function addWaypoint(yjs: YjsState, lat: number, lon: number): void {
  const yMap = new Y.Map();
  yMap.set("lat", lat);
  yMap.set("lon", lon);
  yjs.waypoints.push([yMap]);
}

function createDocMap(): Y.Map<unknown> {
  const doc = new Y.Doc();
  const arr = doc.getArray<Y.Map<unknown>>("test");
  const yMap = new Y.Map<unknown>();
  arr.push([yMap]);
  return yMap;
}

describe("isOvernight", () => {
  it("returns false for a waypoint without overnight flag", () => {
    const yMap = createDocMap();
    yMap.set("lat", 52.52);
    yMap.set("lon", 13.405);
    expect(isOvernight(yMap)).toBe(false);
  });

  it("returns true for a waypoint with overnight flag", () => {
    const yMap = createDocMap();
    yMap.set("lat", 52.52);
    yMap.set("lon", 13.405);
    yMap.set("overnight", true);
    expect(isOvernight(yMap)).toBe(true);
  });

  it("returns false for non-boolean overnight value", () => {
    const yMap = createDocMap();
    yMap.set("overnight", "yes");
    expect(isOvernight(yMap)).toBe(false);
  });
});

describe("setOvernight", () => {
  it("sets overnight flag on a waypoint", () => {
    const yjs = createTestYjs();
    addWaypoint(yjs, 52.52, 13.405);

    setOvernight(yjs, 0, true);

    const yMap = yjs.waypoints.get(0)!;
    expect(yMap.get("overnight")).toBe(true);
  });

  it("clears overnight flag from a waypoint", () => {
    const yjs = createTestYjs();
    addWaypoint(yjs, 52.52, 13.405);

    setOvernight(yjs, 0, true);
    expect(yjs.waypoints.get(0)!.get("overnight")).toBe(true);

    setOvernight(yjs, 0, false);
    expect(yjs.waypoints.get(0)!.get("overnight")).toBeUndefined();
  });

  it("does nothing for out-of-bounds index", () => {
    const yjs = createTestYjs();
    addWaypoint(yjs, 52.52, 13.405);

    // Should not throw
    setOvernight(yjs, 5, true);
    expect(yjs.waypoints.get(0)!.get("overnight")).toBeUndefined();
  });
});
