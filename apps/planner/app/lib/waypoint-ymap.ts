import * as Y from "yjs";
import type { Waypoint, WaypointPoiTags } from "@trails-cool/types";

/**
 * Reads all Waypoint fields from a Yjs map.
 * The "overnight" key maps to isDayBreak (legacy wire name).
 * Add new Waypoint fields here — one place for all consumers.
 */
export function waypointFromYMap(yMap: Y.Map<unknown>): Waypoint {
  return {
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
    name: yMap.get("name") as string | undefined,
    note: yMap.get("note") as string | undefined,
    isDayBreak: yMap.get("overnight") === true ? true : undefined,
    osmId: yMap.get("osmId") as number | undefined,
    poiTags: yMap.get("poiTags") as WaypointPoiTags | undefined,
  };
}

/**
 * Writes all Waypoint fields onto an existing Yjs map.
 * The isDayBreak field is stored as "overnight" (legacy wire name).
 * Add new Waypoint fields here — one place for all producers.
 */
export function applyWaypointToYMap(yMap: Y.Map<unknown>, wp: Waypoint): void {
  yMap.set("lat", wp.lat);
  yMap.set("lon", wp.lon);
  if (wp.name) yMap.set("name", wp.name);
  if (wp.note) yMap.set("note", wp.note);
  if (wp.isDayBreak) yMap.set("overnight", true);
  if (wp.osmId !== undefined) yMap.set("osmId", wp.osmId);
  if (wp.poiTags) yMap.set("poiTags", wp.poiTags);
}

/** Convenience: creates a new Y.Map and populates it from a Waypoint. */
export function waypointToYMap(wp: Waypoint): Y.Map<unknown> {
  const yMap = new Y.Map<unknown>();
  applyWaypointToYMap(yMap, wp);
  return yMap;
}

/** Reads the whole shared waypoint list as plain Waypoints. */
export function extractWaypoints(waypoints: Y.Array<Y.Map<unknown>>): Waypoint[] {
  return waypoints.toArray().map(waypointFromYMap);
}

/** Waypoint flattened for UI state (isDayBreak as a plain boolean). */
export interface WaypointData {
  lat: number;
  lon: number;
  name?: string;
  note?: string;
  overnight: boolean;
}

export function extractWaypointData(waypoints: Y.Array<Y.Map<unknown>>): WaypointData[] {
  return extractWaypoints(waypoints).map((wp) => ({
    lat: wp.lat,
    lon: wp.lon,
    name: wp.name,
    note: wp.note,
    overnight: wp.isDayBreak === true,
  }));
}
