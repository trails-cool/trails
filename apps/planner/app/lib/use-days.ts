import { useEffect, useState } from "react";
import * as Y from "yjs";
import { computeDays, type DayStage } from "@trails-cool/gpx";
import type { Waypoint } from "@trails-cool/types";
import type { TrackPoint } from "@trails-cool/gpx";
import type { YjsState } from "./use-yjs.ts";
import { isOvernight } from "./overnight.ts";

/**
 * Reactive hook that computes day stages from Yjs waypoints and route data.
 * Returns an empty array for single-day routes (no overnight waypoints).
 */
export function useDays(yjs: YjsState | null): DayStage[] {
  const [days, setDays] = useState<DayStage[]>([]);

  useEffect(() => {
    if (!yjs) return;

    const recompute = () => {
      // Extract waypoints with isDayBreak from Yjs
      const waypoints: Waypoint[] = yjs.waypoints.toArray().map((yMap: Y.Map<unknown>) => ({
        lat: yMap.get("lat") as number,
        lon: yMap.get("lon") as number,
        name: yMap.get("name") as string | undefined,
        isDayBreak: isOvernight(yMap) || undefined,
      }));

      // Check if any waypoint has isDayBreak
      const hasBreaks = waypoints.some((w) => w.isDayBreak);
      if (!hasBreaks) {
        setDays([]);
        return;
      }

      // Extract track points from route coordinates stored in Yjs
      const coordsStr = yjs.routeData.get("coordinates") as string | undefined;
      if (!coordsStr) {
        setDays([]);
        return;
      }

      try {
        // coordinates are stored as [[lon, lat, ele], ...] (GeoJSON format)
        const coords: number[][] = JSON.parse(coordsStr);
        const trackPoints: TrackPoint[] = coords.map((c) => ({
          lat: c[1]!,
          lon: c[0]!,
          ele: c[2],
        }));

        setDays(computeDays(waypoints, [trackPoints]));
      } catch {
        setDays([]);
      }
    };

    yjs.waypoints.observeDeep(recompute);
    yjs.routeData.observe(recompute);
    recompute();

    return () => {
      yjs.waypoints.unobserveDeep(recompute);
      yjs.routeData.unobserve(recompute);
    };
  }, [yjs]);

  return days;
}
