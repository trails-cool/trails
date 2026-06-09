import { useEffect, useState } from "react";
import { computeDays, type DayStage } from "@trails-cool/gpx";
import type { TrackPoint } from "@trails-cool/gpx";
import type { YjsState } from "./use-yjs.ts";
import { extractWaypoints } from "./waypoint-ymap.ts";
import { getCoordinates } from "./route-data.ts";

/**
 * Reactive hook that computes day stages from Yjs waypoints and route data.
 * Returns an empty array for single-day routes (no overnight waypoints).
 */
export function useDays(yjs: YjsState | null): DayStage[] {
  const [days, setDays] = useState<DayStage[]>([]);

  useEffect(() => {
    if (!yjs) return;

    const recompute = () => {
      const waypoints = extractWaypoints(yjs.waypoints);

      // Check if any waypoint has isDayBreak
      const hasBreaks = waypoints.some((w) => w.isDayBreak);
      if (!hasBreaks) {
        setDays([]);
        return;
      }

      const coords = getCoordinates(yjs.routeData);
      if (!coords) {
        setDays([]);
        return;
      }

      const trackPoints: TrackPoint[] = coords.map((c) => ({
        lat: c[1],
        lon: c[0],
        ele: c[2],
      }));
      setDays(computeDays(waypoints, [trackPoints]));
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
