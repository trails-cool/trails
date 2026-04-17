import { useState, useCallback, useRef } from "react";
import type { Waypoint } from "@trails-cool/types";
import type { RouteDetail } from "../api-client";
import { updateRoute, computeRoute as apiComputeRoute } from "../api-client";
import { generateGpx } from "@trails-cool/gpx";

export interface RouteSegment {
  coordinates: [number, number][];
}

export interface EditorState {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dirty: boolean;
  computing: boolean;
  saving: boolean;
  error: string | null;
}

export function useRouteEditor(route: RouteDetail) {
  const [state, setState] = useState<EditorState>(() => {
    const waypoints = extractWaypoints(route);
    const segments = extractSegmentsFromGpx(route.gpx);
    return {
      waypoints,
      segments,
      dirty: false,
      computing: false,
      saving: false,
      error: null,
    };
  });

  const segmentsRef = useRef(state.segments);
  segmentsRef.current = state.segments;

  const computeRoute = useCallback(async (waypoints: Waypoint[]) => {
    if (waypoints.length < 2) {
      setState((s) => ({ ...s, segments: [], computing: false }));
      return;
    }

    setState((s) => ({ ...s, computing: true, error: null }));

    try {
      const geojson = await apiComputeRoute(
        waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
        route.routingProfile ?? "fastbike",
      );
      const coords = extractCoordsFromGeojson(geojson);
      setState((s) => ({
        ...s,
        segments: [{ coordinates: coords }],
        computing: false,
      }));
    } catch {
      setState((s) => ({ ...s, computing: false, error: "Route computation failed" }));
    }
  }, [route.routingProfile]);

  const addWaypoint = useCallback((lat: number, lon: number, index?: number) => {
    setState((s) => {
      const wps = [...s.waypoints];
      const wp: Waypoint = { lat, lon };
      if (index !== undefined) {
        wps.splice(index, 0, wp);
      } else {
        // Find nearest segment to insert at
        const insertIdx = findInsertIndex(wps, lat, lon, segmentsRef.current);
        wps.splice(insertIdx, 0, wp);
      }
      computeRoute(wps);
      return { ...s, waypoints: wps, dirty: true };
    });
  }, [computeRoute]);

  const moveWaypoint = useCallback((index: number, lat: number, lon: number) => {
    setState((s) => {
      const wps = [...s.waypoints];
      wps[index] = { ...wps[index]!, lat, lon };
      computeRoute(wps);
      return { ...s, waypoints: wps, dirty: true };
    });
  }, [computeRoute]);

  const deleteWaypoint = useCallback((index: number) => {
    setState((s) => {
      const wps = s.waypoints.filter((_, i) => i !== index);
      computeRoute(wps);
      return { ...s, waypoints: wps, dirty: true };
    });
  }, [computeRoute]);

  const toggleOvernight = useCallback((index: number) => {
    setState((s) => {
      const wps = [...s.waypoints];
      const wp = wps[index]!;
      wps[index] = { ...wp, isDayBreak: !wp.isDayBreak };
      return { ...s, waypoints: wps, dirty: true };
    });
  }, []);

  const save = useCallback(async () => {
    setState((s) => ({ ...s, saving: true, error: null }));

    try {
      const tracks = state.segments.map((seg) =>
        seg.coordinates.map(([lon, lat]) => ({ lat, lon })),
      );

      const gpx = generateGpx({
        name: route.name,
        description: route.description,
        waypoints: state.waypoints,
        tracks,
      });

      await updateRoute(route.id, { gpx });
      setState((s) => ({ ...s, saving: false, dirty: false }));
      return true;
    } catch {
      setState((s) => ({ ...s, saving: false, error: "Failed to save" }));
      return false;
    }
  }, [route.id, route.name, route.description, state.waypoints, state.segments]);

  return {
    ...state,
    addWaypoint,
    moveWaypoint,
    deleteWaypoint,
    toggleOvernight,
    save,
    computeRoute,
  };
}

function extractWaypoints(route: RouteDetail): Waypoint[] {
  if (!route.gpx) return [];
  try {
    // Parse synchronously from the GPX string — waypoints are in the GPX
    // We'll use a simple regex extraction since parseGpxAsync is async
    const wpts: Waypoint[] = [];
    const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/g;
    let match;
    while ((match = wptRegex.exec(route.gpx)) !== null) {
      const lat = parseFloat(match[1]!);
      const lon = parseFloat(match[2]!);
      const inner = match[3]!;
      const nameMatch = inner.match(/<name>([^<]*)<\/name>/);
      const typeMatch = inner.match(/<type>([^<]*)<\/type>/);
      wpts.push({
        lat,
        lon,
        name: nameMatch?.[1] ?? undefined,
        isDayBreak: typeMatch?.[1] === "overnight" ? true : undefined,
      });
    }
    return wpts;
  } catch {
    return [];
  }
}

function extractSegmentsFromGpx(gpx: string | null): RouteSegment[] {
  if (!gpx) return [];
  try {
    const segments: RouteSegment[] = [];
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g;
    const coordinates: [number, number][] = [];
    let match;
    while ((match = trkptRegex.exec(gpx)) !== null) {
      const lat = parseFloat(match[1]!);
      const lon = parseFloat(match[2]!);
      coordinates.push([lon, lat]); // GeoJSON order: [lon, lat]
    }
    if (coordinates.length > 0) {
      segments.push({ coordinates });
    }
    return segments;
  } catch {
    return [];
  }
}

function extractCoordsFromGeojson(geojson: unknown): [number, number][] {
  try {
    const features = (geojson as { features?: unknown[] })?.features;
    if (!features?.[0]) return [];
    const geometry = (features[0] as { geometry?: { coordinates?: number[][] } })?.geometry;
    return (geometry?.coordinates ?? []) as [number, number][];
  } catch {
    return [];
  }
}

function findInsertIndex(
  waypoints: Waypoint[],
  lat: number,
  lon: number,
  segments: RouteSegment[],
): number {
  if (waypoints.length < 2) return waypoints.length;

  // Find the nearest point on the route and determine which segment it falls on
  let minDist = Infinity;
  let bestSegIdx = 0;

  for (let s = 0; s < segments.length; s++) {
    const coords = segments[s]!.coordinates;
    for (const [cLon, cLat] of coords) {
      const dist = (cLat - lat) ** 2 + (cLon - lon) ** 2;
      if (dist < minDist) {
        minDist = dist;
        bestSegIdx = s;
      }
    }
  }

  // Insert after the segment's start waypoint
  return Math.min(bestSegIdx + 1, waypoints.length);
}
