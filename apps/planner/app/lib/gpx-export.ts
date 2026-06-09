import * as Y from "yjs";
import { generateGpx, computeDays } from "@trails-cool/gpx";
import type { TrackPoint } from "@trails-cool/gpx";
import type { Waypoint } from "@trails-cool/types";
import { getCoordinates, extractNoGoAreas } from "./route-data.ts";
import { extractWaypoints } from "./waypoint-ymap.ts";

// Assembles GPX from the collaborative document. Both "save to journal"
// and the export menu go through here so the persisted plan and the
// downloaded file can never diverge.

/** The document parts GPX assembly needs (structural subset of YjsState). */
export interface PlanDoc {
  routeData: Y.Map<unknown>;
  waypoints: Y.Array<Y.Map<unknown>>;
  noGoAreas: Y.Array<Y.Map<unknown>>;
  notes: Y.Text;
}

export const ROUTE_NAME = "trails.cool route";

function getTracks(doc: PlanDoc): TrackPoint[][] {
  const coords = getCoordinates(doc.routeData);
  if (!coords || coords.length === 0) return [];
  return [coords.map((c) => ({ lat: c[1], lon: c[0], ele: c[2] }))];
}

/** The computed track only — no waypoints, no planning data. */
export function buildRouteGpx(doc: PlanDoc): string {
  return generateGpx({ name: ROUTE_NAME, waypoints: [], tracks: getTracks(doc) });
}

/**
 * The full plan: track, waypoints, no-go areas, and session notes —
 * everything needed to round-trip the route through the Journal.
 */
export function buildPlanGpx(doc: PlanDoc): string {
  return generateGpx({
    name: ROUTE_NAME,
    description: doc.notes.toString() || undefined,
    waypoints: extractWaypoints(doc.waypoints),
    tracks: getTracks(doc),
    noGoAreas: extractNoGoAreas(doc.noGoAreas),
  });
}

export function hasDayBreaks(doc: PlanDoc): boolean {
  return extractWaypoints(doc.waypoints).some((w) => w.isDayBreak);
}

export interface GpxFile {
  filename: string;
  gpx: string;
}

/**
 * One GPX file per day stage, split at day-break waypoints. A route
 * without day breaks (or without a computed track) yields a single
 * full-route file.
 */
export function buildDayGpxFiles(doc: PlanDoc): GpxFile[] {
  const tracks = getTracks(doc);
  const waypoints = extractWaypoints(doc.waypoints);
  const allPoints = tracks.flat();
  if (allPoints.length === 0 || waypoints.length === 0) return [];

  const days = computeDays(waypoints, tracks);
  if (days.length <= 1) {
    return [{ filename: "route.gpx", gpx: generateGpx({ name: ROUTE_NAME, tracks }) }];
  }

  // Find closest track index for each waypoint
  const wpTrackIndices = waypoints.map((wp: Waypoint) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < allPoints.length; i++) {
      const dx = allPoints[i]!.lat - wp.lat;
      const dy = allPoints[i]!.lon - wp.lon;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  return days.map((day) => {
    const startIdx = wpTrackIndices[day.startWaypointIndex]!;
    const endIdx = wpTrackIndices[day.endWaypointIndex]!;
    const dayPoints = allPoints.slice(startIdx, endIdx + 1);
    const dayName =
      day.startName && day.endName
        ? `Day ${day.dayNumber}: ${day.startName} - ${day.endName}`
        : `Day ${day.dayNumber}`;
    const filename = `day-${day.dayNumber}${
      day.startName ? `-${day.startName.toLowerCase().replace(/\s+/g, "-")}` : ""
    }.gpx`;
    return { filename, gpx: generateGpx({ name: dayName, tracks: [dayPoints] }) };
  });
}
