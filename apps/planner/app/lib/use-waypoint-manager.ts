import { useEffect, useState, useCallback } from "react";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";
import type { ColorMode } from "~/components/ColoredRoute";
import { usePois } from "~/lib/use-pois";
import { snapToPoi } from "~/lib/poi-snap";
import { isOvernight } from "~/lib/overnight";
import { findSegmentForPoint } from "~/components/ColoredRoute";

export interface WaypointData {
  lat: number;
  lon: number;
  name?: string;
  overnight: boolean;
}

function getWaypointsFromYjs(waypoints: Y.Array<Y.Map<unknown>>): WaypointData[] {
  return waypoints.toArray().map((yMap) => ({
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
    name: yMap.get("name") as string | undefined,
    overnight: isOvernight(yMap),
  }));
}

function pointToSegmentDist(
  pLat: number, pLon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number,
): number {
  const dx = bLon - aLon;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((pLon - aLon) ** 2 + (pLat - aLat) ** 2);
  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / lenSq));
  const projLon = aLon + t * dx;
  const projLat = aLat + t * dy;
  return Math.sqrt((pLon - projLon) ** 2 + (pLat - projLat) ** 2);
}

function parseJsonArray<T>(json: string | undefined): T[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export interface RouteState {
  waypoints: WaypointData[];
  routeCoordinates: [number, number, number][] | null;
  segmentBoundaries: number[];
  surfaces: string[];
  highways: string[];
  maxspeeds: string[];
  smoothnesses: string[];
  tracktypes: string[];
  cycleways: string[];
  bikeroutes: string[];
  colorMode: ColorMode;
}

export function useWaypointManager(
  yjs: YjsState,
  poiState: ReturnType<typeof usePois>,
  suppressMapClickRef: React.RefObject<boolean>,
  onRouteRequest?: (waypoints: WaypointData[]) => void,
) {
  const [state, setState] = useState<RouteState>({
    waypoints: [],
    routeCoordinates: null,
    segmentBoundaries: [],
    surfaces: [],
    highways: [],
    maxspeeds: [],
    smoothnesses: [],
    tracktypes: [],
    cycleways: [],
    bikeroutes: [],
    colorMode: "plain",
  });

  // Sync waypoints from Yjs
  useEffect(() => {
    const update = () => {
      const wps = getWaypointsFromYjs(yjs.waypoints);
      setState((prev) => ({ ...prev, waypoints: wps }));
      if (wps.length >= 2 && onRouteRequest) {
        onRouteRequest(wps);
      }
    };
    yjs.waypoints.observeDeep(update);
    update();
    return () => yjs.waypoints.unobserveDeep(update);
  }, [yjs.waypoints, onRouteRequest]);

  // Sync route data from Yjs
  useEffect(() => {
    const update = () => {
      const coordsJson = yjs.routeData.get("coordinates") as string | undefined;
      const boundsJson = yjs.routeData.get("segmentBoundaries") as string | undefined;
      const modeVal = yjs.routeData.get("colorMode") as ColorMode | undefined;

      let routeCoordinates: [number, number, number][] | null = null;
      if (coordsJson) {
        try { routeCoordinates = JSON.parse(coordsJson); } catch { /* ignore */ }
      } else {
        // Fallback: parse from geojson for backwards compat
        const geojson = yjs.routeData.get("geojson") as string | undefined;
        if (geojson) {
          try {
            const parsed = JSON.parse(geojson);
            const coords = parsed.features?.[0]?.geometry?.coordinates;
            if (coords) {
              routeCoordinates = coords.map((c: number[]) => [c[0]!, c[1]!, c[2] ?? 0] as [number, number, number]);
            }
          } catch { /* ignore */ }
        }
      }

      setState((prev) => ({
        ...prev,
        routeCoordinates,
        segmentBoundaries: parseJsonArray<number>(boundsJson),
        surfaces: parseJsonArray<string>(yjs.routeData.get("surfaces") as string | undefined),
        highways: parseJsonArray<string>(yjs.routeData.get("highways") as string | undefined),
        maxspeeds: parseJsonArray<string>(yjs.routeData.get("maxspeeds") as string | undefined),
        smoothnesses: parseJsonArray<string>(yjs.routeData.get("smoothnesses") as string | undefined),
        tracktypes: parseJsonArray<string>(yjs.routeData.get("tracktypes") as string | undefined),
        cycleways: parseJsonArray<string>(yjs.routeData.get("cycleways") as string | undefined),
        bikeroutes: parseJsonArray<string>(yjs.routeData.get("bikeroutes") as string | undefined),
        colorMode: modeVal ?? "plain",
      }));
    };
    yjs.routeData.observe(update);
    update();
    return () => yjs.routeData.unobserve(update);
  }, [yjs.routeData]);

  const addWaypoint = useCallback(
    (lat: number, lng: number, name?: string) => {
      const { routeCoordinates, segmentBoundaries } = state;
      const snap = snapToPoi(lat, lng, poiState.pois);
      const finalLat = snap.lat;
      const finalLon = snap.snapped ? snap.lon : lng;

      let insertIndex = yjs.waypoints.length;
      if (routeCoordinates && routeCoordinates.length >= 2 && segmentBoundaries.length > 0) {
        let bestDist = Infinity;
        let bestSegment = -1;
        for (let seg = 0; seg < segmentBoundaries.length; seg++) {
          const start = segmentBoundaries[seg]!;
          const end = seg + 1 < segmentBoundaries.length ? segmentBoundaries[seg + 1]! : routeCoordinates.length;
          for (let i = start; i < end - 1; i++) {
            const c1 = routeCoordinates[i]!;
            const c2 = routeCoordinates[i + 1]!;
            const dist = pointToSegmentDist(finalLat, finalLon, c1[1]!, c1[0]!, c2[1]!, c2[0]!);
            if (dist < bestDist) {
              bestDist = dist;
              bestSegment = seg;
            }
          }
        }
        if (bestDist < 0.01 && bestSegment >= 0) {
          insertIndex = bestSegment + 1;
        }
      }

      yjs.doc.transact(() => {
        const yMap = new Y.Map();
        yMap.set("lat", finalLat);
        yMap.set("lon", finalLon);
        if (snap.name) yMap.set("name", snap.name);
        else if (name) yMap.set("name", name);
        if (snap.osmId) yMap.set("osmId", snap.osmId);
        if (snap.poiTags) yMap.set("poiTags", snap.poiTags);
        yjs.waypoints.insert(insertIndex, [yMap]);
      }, "local");
    },
    [yjs.doc, yjs.waypoints, poiState.pois, state],
  );

  const insertWaypointAtSegment = useCallback(
    (segmentIndex: number, lat: number, lon: number) => {
      const snap = snapToPoi(lat, lon, poiState.pois);
      yjs.doc.transact(() => {
        const yMap = new Y.Map();
        yMap.set("lat", snap.lat);
        yMap.set("lon", snap.snapped ? snap.lon : lon);
        if (snap.name) yMap.set("name", snap.name);
        if (snap.osmId) yMap.set("osmId", snap.osmId);
        if (snap.poiTags) yMap.set("poiTags", snap.poiTags);
        yjs.waypoints.insert(segmentIndex + 1, [yMap]);
      }, "local");
    },
    [yjs.doc, yjs.waypoints, poiState.pois],
  );

  const handleRouteInsert = useCallback(
    (pointIndex: number, lat: number, lon: number) => {
      suppressMapClickRef.current = true;
      const segIdx = findSegmentForPoint(pointIndex, state.segmentBoundaries);
      insertWaypointAtSegment(segIdx, lat, lon);
    },
    [state.segmentBoundaries, insertWaypointAtSegment, suppressMapClickRef],
  );

  const moveWaypoint = useCallback(
    (index: number, lat: number, lng: number) => {
      const snap = snapToPoi(lat, lng, poiState.pois);
      const yMap = yjs.waypoints.get(index);
      if (yMap) {
        yjs.doc.transact(() => {
          yMap.set("lat", snap.lat);
          yMap.set("lon", snap.snapped ? snap.lon : lng);
          if (snap.snapped && snap.name) {
            yMap.set("name", snap.name);
          } else {
            yMap.delete("name");
          }
          if (snap.osmId) {
            yMap.set("osmId", snap.osmId);
            if (snap.poiTags) yMap.set("poiTags", snap.poiTags);
          } else {
            yMap.delete("osmId");
            yMap.delete("poiTags");
          }
        }, "local");
      }
    },
    [yjs.waypoints, yjs.doc, poiState.pois],
  );

  const deleteWaypoint = useCallback(
    (index: number) => {
      yjs.doc.transact(() => {
        yjs.waypoints.delete(index, 1);
      }, "local");
    },
    [yjs.waypoints],
  );

  const handleRoutePolylineHover = useCallback(
    (e: { latlng: { lat: number; lng: number } }, onRouteHover: (d: number | null) => void) => {
      const { routeCoordinates } = state;
      if (!routeCoordinates || routeCoordinates.length < 2) return;
      const { lat, lng } = e.latlng;

      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < routeCoordinates.length; i++) {
        const c = routeCoordinates[i]!;
        const dLat = c[1]! - lat;
        const dLon = c[0]! - lng;
        const dist = dLat * dLat + dLon * dLon;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      let totalDist = 0;
      for (let i = 1; i <= bestIdx; i++) {
        const prev = routeCoordinates[i - 1]!;
        const curr = routeCoordinates[i]!;
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(curr[1]! - prev[1]!);
        const dLon = toRad(curr[0]! - prev[0]!);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(prev[1]!)) * Math.cos(toRad(curr[1]!)) * Math.sin(dLon / 2) ** 2;
        totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      onRouteHover(totalDist);
    },
    [state],
  );

  return {
    ...state,
    addWaypoint,
    insertWaypointAtSegment,
    handleRouteInsert,
    moveWaypoint,
    deleteWaypoint,
    handleRoutePolylineHover,
  };
}
