import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { Waypoint } from "@trails-cool/types";
import {
  extractWaypointData,
  extractWaypoints,
  waypointFromYMap,
  waypointToYMap,
} from "./waypoint-ymap.ts";

function createArray(): Y.Array<Y.Map<unknown>> {
  return new Y.Doc().getArray<Y.Map<unknown>>("waypoints");
}

/** Y.Maps only expose values once integrated into a document. */
function roundTrip(wp: Waypoint): Waypoint {
  const arr = createArray();
  arr.push([waypointToYMap(wp)]);
  return waypointFromYMap(arr.get(0)!);
}

describe("waypoint round-trip", () => {
  it("preserves all fields through toYMap → fromYMap", () => {
    const wp: Waypoint = {
      lat: 52.5,
      lon: 13.4,
      name: "Hut",
      note: "Book ahead",
      isDayBreak: true,
      osmId: 12345,
      poiTags: { tourism: "alpine_hut" },
    };
    expect(roundTrip(wp)).toEqual(wp);
  });

  it("leaves optional fields undefined", () => {
    const wp = roundTrip({ lat: 1, lon: 2 });
    expect(wp).toEqual({
      lat: 1,
      lon: 2,
      name: undefined,
      note: undefined,
      isDayBreak: undefined,
      osmId: undefined,
      poiTags: undefined,
    });
  });
});

describe("extractWaypoints", () => {
  it("reads the whole list in order", () => {
    const arr = createArray();
    arr.push([
      waypointToYMap({ lat: 1, lon: 2, name: "A" }),
      waypointToYMap({ lat: 3, lon: 4, isDayBreak: true }),
    ]);

    const wps = extractWaypoints(arr);
    expect(wps).toHaveLength(2);
    expect(wps[0]!.name).toBe("A");
    expect(wps[1]!.isDayBreak).toBe(true);
  });
});

describe("extractWaypointData", () => {
  it("flattens isDayBreak to a plain overnight boolean", () => {
    const arr = createArray();
    arr.push([
      waypointToYMap({ lat: 1, lon: 2 }),
      waypointToYMap({ lat: 3, lon: 4, isDayBreak: true, note: "n" }),
    ]);

    const data = extractWaypointData(arr);
    expect(data[0]!.overnight).toBe(false);
    expect(data[1]!).toEqual({ lat: 3, lon: 4, name: undefined, note: "n", overnight: true });
  });
});
