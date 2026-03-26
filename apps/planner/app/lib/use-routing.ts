import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { YjsState } from "./use-yjs.ts";
import { electHost } from "./host-election.ts";

interface RouteStats {
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
}

interface WaypointData {
  lat: number;
  lon: number;
}

function getWaypointsFromYjs(waypoints: Y.Array<Y.Map<unknown>>): WaypointData[] {
  return waypoints.toArray().map((yMap) => ({
    lat: yMap.get("lat") as number,
    lon: yMap.get("lon") as number,
  }));
}

export function useRouting(yjs: YjsState | null) {
  const [isHost, setIsHost] = useState(false);
  const [computing, setComputing] = useState(false);
  const [routeStats, setRouteStats] = useState<RouteStats>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Host election via Yjs awareness
  useEffect(() => {
    if (!yjs) return;

    const checkHost = () => {
      const states = yjs.awareness.getStates() as Map<number, Record<string, unknown>>;
      const localId = yjs.awareness.clientID;
      const { isHost: amHost, role } = electHost(states, localId);
      setIsHost(amHost);
      yjs.awareness.setLocalStateField("role", role);
    };

    yjs.awareness.on("change", checkHost);
    checkHost();

    return () => {
      yjs.awareness.off("change", checkHost);
    };
  }, [yjs]);

  const computeRoute = useCallback(
    async (waypoints: WaypointData[]) => {
      if (!yjs || !isHost || waypoints.length < 2) return;

      // Collect no-go areas from Yjs
      const noGoAreas = yjs.noGoAreas.toArray().map((yMap) => ({
        points: (yMap.get("points") as Array<{ lat: number; lon: number }>) ?? [],
      })).filter((a) => a.points.length >= 3);

      setComputing(true);
      try {
        const response = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waypoints,
            profile: (yjs.routeData.get("profile") as string) ?? "trekking",
            noGoAreas: noGoAreas.length > 0 ? noGoAreas : undefined,
          }),
        });

        if (response.status === 429) {
          console.warn("[Rate Limit] Route computation rate limit exceeded");
          return;
        }
        if (!response.ok) return;

        const enriched = await response.json();

        setRouteStats({
          distance: enriched.totalLength || undefined,
          elevationGain: enriched.totalAscend || undefined,
        });

        // Store enriched route data in Yjs for all participants
        yjs.doc.transact(() => {
          yjs.routeData.set("geojson", JSON.stringify(enriched.geojson));
          yjs.routeData.set("coordinates", JSON.stringify(enriched.coordinates));
          yjs.routeData.set("segmentBoundaries", JSON.stringify(enriched.segmentBoundaries));
          if (enriched.surfaces?.length) {
            yjs.routeData.set("surfaces", JSON.stringify(enriched.surfaces));
          }
        });
      } catch {
        // Route computation failed
      } finally {
        setComputing(false);
      }
    },
    [yjs, isHost],
  );

  const requestRoute = useCallback(
    (waypoints: WaypointData[]) => {
      if (!isHost) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => computeRoute(waypoints), 500);
    },
    [isHost, computeRoute],
  );

  // Watch for profile changes and trigger recompute
  useEffect(() => {
    if (!yjs || !isHost) return;

    const triggerRecompute = () => {
      const wps = getWaypointsFromYjs(yjs.waypoints);
      if (wps.length >= 2) {
        requestRoute(wps);
      }
    };

    // Observe routeData for profile changes
    const profileObserver = (event: Y.YMapEvent<unknown>) => {
      if (event.keysChanged.has("profile")) {
        triggerRecompute();
      }
    };

    // Observe noGoAreas for changes
    const noGoObserver = () => {
      triggerRecompute();
    };

    yjs.routeData.observe(profileObserver);
    yjs.noGoAreas.observeDeep(noGoObserver);
    return () => {
      yjs.routeData.unobserve(profileObserver);
      yjs.noGoAreas.unobserveDeep(noGoObserver);
    };
  }, [yjs, isHost, requestRoute]);

  return { isHost, computing, routeStats, requestRoute };
}
