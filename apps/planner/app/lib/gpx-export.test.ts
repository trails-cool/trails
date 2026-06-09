import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { Waypoint } from "@trails-cool/types";
import { waypointToYMap } from "./waypoint-ymap.ts";
import {
  buildDayGpxFiles,
  buildPlanGpx,
  buildRouteGpx,
  hasDayBreaks,
  type PlanDoc,
} from "./gpx-export.ts";

function createDoc(): PlanDoc & { doc: Y.Doc } {
  const doc = new Y.Doc();
  return {
    doc,
    routeData: doc.getMap("routeData"),
    waypoints: doc.getArray<Y.Map<unknown>>("waypoints"),
    noGoAreas: doc.getArray<Y.Map<unknown>>("noGoAreas"),
    notes: doc.getText("notes"),
  };
}

function addWaypoints(doc: PlanDoc, waypoints: Waypoint[]): void {
  doc.waypoints.push(waypoints.map(waypointToYMap));
}

function setTrack(doc: PlanDoc, coords: [number, number, number][]): void {
  doc.routeData.set("coordinates", JSON.stringify(coords));
}

const TRACK: [number, number, number][] = [
  [13.4, 52.5, 35],
  [13.41, 52.51, 40],
  [13.42, 52.52, 38],
  [13.43, 52.53, 42],
];

describe("buildRouteGpx", () => {
  it("contains the track but no waypoints", () => {
    const doc = createDoc();
    setTrack(doc, TRACK);
    addWaypoints(doc, [
      { lat: 52.5, lon: 13.4, name: "Start" },
      { lat: 52.53, lon: 13.43, name: "End" },
    ]);

    const gpx = buildRouteGpx(doc);
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain('lat="52.5"');
    expect(gpx).not.toContain("<wpt");
  });

  it("produces a track-less GPX for an empty document", () => {
    const gpx = buildRouteGpx(createDoc());
    expect(gpx).toContain("<gpx");
    expect(gpx).not.toContain("<trkpt");
  });
});

describe("buildPlanGpx", () => {
  it("includes waypoints, no-go areas, and notes", () => {
    const doc = createDoc();
    setTrack(doc, TRACK);
    addWaypoints(doc, [
      { lat: 52.5, lon: 13.4, name: "Start" },
      { lat: 52.53, lon: 13.43, name: "End" },
    ]);
    const area = new Y.Map<unknown>();
    area.set("points", [
      { lat: 52.5, lon: 13.4 },
      { lat: 52.51, lon: 13.41 },
      { lat: 52.52, lon: 13.4 },
    ]);
    doc.noGoAreas.push([area]);
    doc.notes.insert(0, "Pack sunscreen");

    const gpx = buildPlanGpx(doc);
    expect(gpx).toContain("<wpt");
    expect(gpx).toContain("Start");
    expect(gpx).toContain("Pack sunscreen");
    expect(gpx).toContain("trails:"); // no-go areas ride in the trails extension namespace
  });

  it("matches buildRouteGpx track content so save and export cannot diverge", () => {
    const doc = createDoc();
    setTrack(doc, TRACK);
    const routeTrkpts = (buildRouteGpx(doc).match(/<trkpt/g) ?? []).length;
    const planTrkpts = (buildPlanGpx(doc).match(/<trkpt/g) ?? []).length;
    expect(planTrkpts).toBe(routeTrkpts);
    expect(planTrkpts).toBe(TRACK.length);
  });
});

describe("day exports", () => {
  it("hasDayBreaks reflects overnight waypoints", () => {
    const doc = createDoc();
    addWaypoints(doc, [{ lat: 52.5, lon: 13.4 }, { lat: 52.53, lon: 13.43 }]);
    expect(hasDayBreaks(doc)).toBe(false);

    const withBreak = createDoc();
    addWaypoints(withBreak, [
      { lat: 52.5, lon: 13.4 },
      { lat: 52.51, lon: 13.41, isDayBreak: true },
      { lat: 52.53, lon: 13.43 },
    ]);
    expect(hasDayBreaks(withBreak)).toBe(true);
  });

  it("returns [] without a track or waypoints", () => {
    expect(buildDayGpxFiles(createDoc())).toEqual([]);
  });

  it("exports a single route file when there are no day breaks", () => {
    const doc = createDoc();
    setTrack(doc, TRACK);
    addWaypoints(doc, [{ lat: 52.5, lon: 13.4 }, { lat: 52.53, lon: 13.43 }]);

    const files = buildDayGpxFiles(doc);
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("route.gpx");
  });

  it("splits at day-break waypoints into per-day files", () => {
    const doc = createDoc();
    setTrack(doc, TRACK);
    addWaypoints(doc, [
      { lat: 52.5, lon: 13.4, name: "Alpha" },
      { lat: 52.51, lon: 13.41, name: "Hut", isDayBreak: true },
      { lat: 52.53, lon: 13.43, name: "Omega" },
    ]);

    const files = buildDayGpxFiles(doc);
    expect(files).toHaveLength(2);
    expect(files[0]!.filename).toBe("day-1-alpha.gpx");
    expect(files[0]!.gpx).toContain("Day 1: Alpha - Hut");
    expect(files[1]!.filename).toBe("day-2-hut.gpx");
    expect(files[1]!.gpx).toContain("Day 2: Hut - Omega");

    // Day 1 covers track points up to the hut; day 2 the rest.
    expect((files[0]!.gpx.match(/<trkpt/g) ?? []).length).toBe(2);
    expect((files[1]!.gpx.match(/<trkpt/g) ?? []).length).toBe(3);
  });
});
